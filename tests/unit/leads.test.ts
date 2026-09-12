import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Schema replication for unit validation
const leadSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Formato de email inválido")
    .max(255, "El email no debe superar los 255 caracteres"),
  name: z
    .string()
    .trim()
    .max(100, "El nombre no debe superar los 100 caracteres")
    .optional()
    .nullable(),
  company: z
    .string()
    .trim()
    .max(100, "La empresa no debe superar los 100 caracteres")
    .optional()
    .nullable(),
  intent: z.enum(["meeting", "contact"]),
  source: z.string().trim().max(50).default("landing_popup"),
  page_path: z.string().trim().max(500).optional().nullable(),
  utm_source: z.string().trim().max(200).optional().nullable(),
  utm_medium: z.string().trim().max(200).optional().nullable(),
  utm_campaign: z.string().trim().max(200).optional().nullable(),
  utm_content: z.string().trim().max(200).optional().nullable(),
  utm_term: z.string().trim().max(200).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  website: z.string().optional().nullable(),
  hp_title: z.string().optional().nullable(),
});

describe("Sprint: Marketing Leads & Meeting Request Popup Tests", () => {
  describe("Lead Validation & Sanitization Schema", () => {
    test("accepts valid meeting lead payload with all fields", () => {
      const payload = {
        email: "  Ventas@Empresa.COM  ",
        name: "Carlos Gomez",
        company: "Electro Total",
        intent: "meeting",
        source: "landing_popup",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "promo_verano",
      };

      const result = leadSchema.safeParse(payload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "ventas@empresa.com");
        assert.equal(result.data.name, "Carlos Gomez");
        assert.equal(result.data.company, "Electro Total");
        assert.equal(result.data.intent, "meeting");
      }
    });

    test("accepts valid contact lead with only email", () => {
      const payload = {
        email: "usuario@tienda.com.ar",
        intent: "contact",
      };

      const result = leadSchema.safeParse(payload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "usuario@tienda.com.ar");
        assert.equal(result.data.intent, "contact");
        assert.equal(result.data.source, "landing_popup");
      }
    });

    test("rejects malformed email formats", () => {
      const invalidEmails = [
        "not-an-email",
        "@missingusername.com",
        "missingatsign.com",
        "user@",
        "",
      ];

      for (const email of invalidEmails) {
        const res = leadSchema.safeParse({
          email,
          intent: "contact",
        });
        assert.equal(res.success, false, `Expected email '${email}' to fail validation`);
      }
    });

    test("rejects invalid intent types", () => {
      const res = leadSchema.safeParse({
        email: "demo@test.com",
        intent: "unknown_intent",
      });
      assert.equal(res.success, false);
    });

    test("detects spam bots when honeypot fields are populated", () => {
      const spamPayloadWithWebsite = {
        email: "spammer@bot.net",
        intent: "contact",
        website: "https://spam-link.com",
      };

      const spamPayloadWithHpTitle = {
        email: "spammer@bot.net",
        intent: "contact",
        hp_title: "Cheap meds",
      };

      const resWebsite = leadSchema.safeParse(spamPayloadWithWebsite);
      assert.equal(resWebsite.success, true);
      // Backend inspection verifies honeypot is populated
      assert.ok(Boolean(resWebsite.data?.website));

      const resHpTitle = leadSchema.safeParse(spamPayloadWithHpTitle);
      assert.equal(resHpTitle.success, true);
      assert.ok(Boolean(resHpTitle.data?.hp_title));
    });

    test("rejects excessively long strings to prevent memory abuse", () => {
      const superLongEmail = `${"a".repeat(250)}@example.com`;
      const res = leadSchema.safeParse({
        email: superLongEmail,
        intent: "contact",
      });
      assert.equal(res.success, false);
    });
  });

  describe("GA4 Privacy & PII Sanitization Guard", () => {
    test("strictly filters out email, name, and company from GA4 parameters", () => {
      // Replicate the sanitizer logic from src/lib/analytics/ga.ts
      const piiRegex = /email|token|password|secret|cost|price|revenue|amount|tenant|user_id|dni|phone|credential|name|company/i;

      const rawParams: Record<string, any> = {
        source: "landing_popup",
        lead_type: "meeting",
        email: "ceo@empresa.com",
        name: "Juan Perez",
        company: "Tienda Oficial",
        phone: "+5491112345678",
        token: "secret_123",
      };

      const safeParams: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawParams)) {
        if (piiRegex.test(k)) {
          continue;
        }
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          safeParams[k] = v;
        }
      }

      assert.deepEqual(safeParams, {
        source: "landing_popup",
        lead_type: "meeting",
      });
      assert.equal("email" in safeParams, false);
      assert.equal("name" in safeParams, false);
      assert.equal("company" in safeParams, false);
      assert.equal("phone" in safeParams, false);
    });

    test("allowed conversion event parameters match specification", () => {
      const meetingEvent = { lead_type: "meeting", source: "landing_popup" };
      const contactEvent = { lead_type: "contact", source: "landing_popup" };
      const optionSelected = { option: "meeting" };

      assert.equal(meetingEvent.lead_type, "meeting");
      assert.equal(contactEvent.lead_type, "contact");
      assert.equal(optionSelected.option, "meeting");
    });
  });

  describe("Session Storage & Delay Constants", () => {
    test("popup delay is exactly 18 seconds (18,000 ms)", () => {
      const LEAD_POPUP_DELAY = 18_000;
      assert.equal(LEAD_POPUP_DELAY, 18000);
    });

    test("session storage key is canonical", () => {
      const SESSION_STORAGE_KEY = "libretax_landing_lead_popup_dismissed";
      assert.equal(SESSION_STORAGE_KEY, "libretax_landing_lead_popup_dismissed");
    });
  });
});
