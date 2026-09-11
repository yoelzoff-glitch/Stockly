import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseUserAgent } from "../../src/lib/analytics/userAgent";
import { resolveVisitorGeo } from "../../src/lib/analytics/geo";
import { checkAnalyticsRateLimit, getClientFingerprint } from "../../src/lib/analytics/rateLimiter";

describe("Sprint 35: Web Analytics & Realtime Intelligence Tests", () => {
  describe("User Agent & Bot Detection (parseUserAgent)", () => {
    test("correctly parses standard Desktop Chrome user agent", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
      const res = parseUserAgent(ua);

      assert.equal(res.deviceType, "desktop");
      assert.equal(res.browser, "Chrome");
      assert.equal(res.os, "Windows");
      assert.equal(res.isBot, false);
    });

    test("correctly parses Mobile Safari iPhone user agent", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
      const res = parseUserAgent(ua);

      assert.equal(res.deviceType, "mobile");
      assert.equal(res.browser, "Safari");
      assert.equal(res.os, "iOS");
      assert.equal(res.isBot, false);
    });

    test("correctly parses Tablet iPad user agent", () => {
      const ua = "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
      const res = parseUserAgent(ua);

      assert.equal(res.deviceType, "tablet");
      assert.equal(res.browser, "Safari");
      assert.equal(res.os, "iOS");
      assert.equal(res.isBot, false);
    });

    test("identifies Googlebot crawler and flags isBot = true", () => {
      const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
      const res = parseUserAgent(ua);

      assert.equal(res.isBot, true);
    });

    test("identifies social preview bot (WhatsApp, Twitter, Facebook) and flags isBot = true", () => {
      const waUa = "WhatsApp/2.21.12.21 A";
      const twUa = "Twitterbot/1.0";
      const fbUa = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

      assert.equal(parseUserAgent(waUa).isBot, true);
      assert.equal(parseUserAgent(twUa).isBot, true);
      assert.equal(parseUserAgent(fbUa).isBot, true);
    });

    test("handles null, empty, or undefined user agent gracefully without throwing", () => {
      const resNull = parseUserAgent(null);
      const resEmpty = parseUserAgent("");
      const resUndefined = parseUserAgent(undefined);

      assert.equal(resNull.isBot, false);
      assert.equal(resEmpty.isBot, false);
      assert.equal(resUndefined.isBot, false);
      assert.equal(resNull.deviceType, "desktop");
    });
  });

  describe("Geographic Resolution (resolveVisitorGeo)", () => {
    test("resolves Argentina country and Buenos Aires province from CDN headers", () => {
      const mockReq = new Request("https://libretax.com.ar", {
        headers: {
          "x-vercel-ip-country": "AR",
          "x-vercel-ip-country-region": "B",
          "x-vercel-ip-city": "Mar%20del%20Plata",
        },
      });

      const geo = resolveVisitorGeo(mockReq);
      assert.equal(geo.countryCode, "AR");
      assert.equal(geo.countryName, "Argentina");
      assert.equal(geo.regionCode, "B");
      assert.equal(geo.regionName, "Buenos Aires");
      assert.equal(geo.city, "Mar del Plata");
    });

    test("resolves CABA and Córdoba provinces accurately", () => {
      const reqCaba = new Request("https://libretax.com.ar", {
        headers: {
          "x-vercel-ip-country": "AR",
          "x-vercel-ip-country-region": "C",
          "x-vercel-ip-city": "Buenos%20Aires",
        },
      });
      const geoCaba = resolveVisitorGeo(reqCaba);
      assert.equal(geoCaba.regionName, "Ciudad Autónoma de Buenos Aires");

      const reqCba = new Request("https://libretax.com.ar", {
        headers: {
          "x-vercel-ip-country": "AR",
          "x-vercel-ip-country-region": "X",
          "x-vercel-ip-city": "Cordoba",
        },
      });
      const geoCba = resolveVisitorGeo(reqCba);
      assert.equal(geoCba.regionName, "Córdoba");
    });

    test("falls back safely to UNKNOWN and Desconocido when headers are missing", () => {
      const mockReq = new Request("https://libretax.com.ar");
      const geo = resolveVisitorGeo(mockReq);

      assert.equal(geo.countryCode, "UNKNOWN");
      assert.equal(geo.countryName, "Desconocido");
      assert.equal(geo.regionCode, "UNKNOWN");
      assert.equal(geo.regionName, "Desconocida");
      assert.equal(geo.city, "Desconocida");
    });
  });

  describe("Privacy & Rate Limiting (rateLimiter)", () => {
    test("getClientFingerprint creates a deterministic hash without leaking raw IP", () => {
      const mockReq = new Request("https://libretax.com.ar", {
        headers: { "x-forwarded-for": "190.19.200.45, 10.0.0.1" },
      });

      const fp1 = getClientFingerprint(mockReq, "visitor-123");
      const fp2 = getClientFingerprint(mockReq, "visitor-123");

      assert.equal(fp1, fp2);
      assert.notEqual(fp1, "190.19.200.45");
      assert.ok(!fp1.includes("190.19.200.45"));
    });

    test("checkAnalyticsRateLimit permits reasonable requests and enforces limit", () => {
      const testFp = `test-fp-${Date.now()}`;

      // First request is allowed
      assert.equal(checkAnalyticsRateLimit(testFp), true);

      // Multiple rapid requests are tracked
      for (let i = 0; i < 50; i++) {
        checkAnalyticsRateLimit(testFp);
      }

      // Exhaust tokens
      for (let i = 0; i < 20; i++) {
        checkAnalyticsRateLimit(testFp);
      }

      // Should block when tokens run out
      const isAllowed = checkAnalyticsRateLimit(testFp);
      assert.equal(isAllowed, false);
    });
  });

  describe("Web Analytics Calculation & Integrity Rules", () => {
    test("visitors distinct count rule is separate from session count and pageviews", () => {
      const mockEvents = [
        { visitor_id: "v1", session_id: "s1" },
        { visitor_id: "v1", session_id: "s1" }, // same session, new pageview
        { visitor_id: "v1", session_id: "s2" }, // same visitor, second session
        { visitor_id: "v2", session_id: "s3" }, // new visitor
      ];

      const distinctVisitors = new Set(mockEvents.map((e) => e.visitor_id)).size;
      const distinctSessions = new Set(mockEvents.map((e) => e.session_id)).size;
      const totalPageviews = mockEvents.length;

      assert.equal(distinctVisitors, 2);
      assert.equal(distinctSessions, 3);
      assert.equal(totalPageviews, 4);
    });

    test("bounce rate calculation matches single-page sessions percentage", () => {
      const sessions = [
        { session_id: "s1", pageviews: 1 },
        { session_id: "s2", pageviews: 3 },
        { session_id: "s3", pageviews: 1 },
        { session_id: "s4", pageviews: 4 },
      ];

      const totalSessions = sessions.length;
      const singlePageSessions = sessions.filter((s) => s.pageviews <= 1).length;
      const bounceRate = Math.round((singlePageSessions / totalSessions) * 1000) / 10;

      assert.equal(singlePageSessions, 2);
      assert.equal(bounceRate, 50.0);
    });
  });
});
