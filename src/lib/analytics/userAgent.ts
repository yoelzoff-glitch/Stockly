import "server-only";

export interface ParsedUserAgent {
  deviceType: "desktop" | "mobile" | "tablet" | "other";
  browser: string;
  os: string;
  isBot: boolean;
}

const KNOWN_BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /duckduckbot/i,
  /slurp/i,
  /bytespider/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /applebot/i,
  /pingdom/i,
  /uptimerobot/i,
  /statuscake/i,
  /headlesschrome/i,
  /lighthouse/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /crawler/i,
  /spider/i,
  /robot/i,
  /crawling/i,
  /bot\b/i,
];

/**
 * Parses user-agent string into device category, browser, OS, and bot detection.
 */
export function parseUserAgent(uaString?: string | null): ParsedUserAgent {
  if (!uaString || typeof uaString !== "string") {
    return {
      deviceType: "desktop",
      browser: "Other",
      os: "Other",
      isBot: false,
    };
  }

  const ua = uaString.trim();

  // 1. Bot detection
  const isBot = KNOWN_BOT_PATTERNS.some((pattern) => pattern.test(ua));

  // 2. Device detection
  let deviceType: "desktop" | "mobile" | "tablet" | "other" = "desktop";
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua)) {
    deviceType = "tablet";
  } else if (/(mobi|ipod|phone|iphone|blackberry|iemobile|opera mini|webos)/i.test(ua)) {
    deviceType = "mobile";
  } else if (/desktop|macintosh|windows|linux|cros/i.test(ua)) {
    deviceType = "desktop";
  } else {
    deviceType = "other";
  }

  // 3. Browser detection
  let browser = "Other";
  if (/edg([ea]|ios)?\/([0-9.]+)/i.test(ua)) {
    browser = "Edge";
  } else if (/opr\/|opera/i.test(ua)) {
    browser = "Opera";
  } else if (/chrome|crios/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
    browser = "Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/msie|trident/i.test(ua)) {
    browser = "Internet Explorer";
  }

  // 4. OS detection
  let os = "Other";
  if (/windows nt/i.test(ua)) {
    os = "Windows";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/mac os x|macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/cros/i.test(ua)) {
    os = "ChromeOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  return {
    deviceType,
    browser,
    os,
    isBot,
  };
}
