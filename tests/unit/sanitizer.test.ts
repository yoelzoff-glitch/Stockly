import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeLogData, maskEmail, maskPhone, sanitizeStringText } from "../../src/lib/observability/sanitizer";

describe("Sanitizer & Masking Tests", () => {
  describe("maskEmail", () => {
    test("masks standard email", () => {
      assert.equal(maskEmail("john.doe@example.com"), "j***@example.com");
    });
    test("handles short emails", () => {
      assert.equal(maskEmail("a@example.com"), "*@example.com");
    });
    test("handles invalid email string", () => {
      assert.equal(maskEmail("invalid-email"), "[REDACTED_EMAIL]");
    });
  });

  describe("maskPhone", () => {
    test("masks phone preserving prefix and last 4 digits", () => {
      const masked = maskPhone("+5491112345678");
      assert.ok(masked.includes("****"));
      assert.ok(masked.endsWith("5678"));
      assert.ok(!masked.includes("12345678"), "Full phone must never appear");
    });
  });

  describe("sanitizeStringText (embedded detection in text)", () => {
    test("redacts embedded emails inside error messages or logs", () => {
      const text = "Error contacting user john.appleseed@company.com on server";
      const sanitized = sanitizeStringText(text);
      assert.ok(!sanitized.includes("john.appleseed@company.com"));
      assert.ok(sanitized.includes("j***@company.com"));
    });

    test("redacts embedded phone numbers inside free text", () => {
      const text = "Webhook received incoming message from +5491144448888 regarding order";
      const sanitized = sanitizeStringText(text);
      assert.ok(!sanitized.includes("44448888"), "Full phone number must not appear in string");
      assert.ok(sanitized.includes("****8888"));
    });

    test("preserves correlation ID UUIDs and ISO timestamps in free text", () => {
      const uuid = "08baf201-079b-4ef6-8769-9990c6112345";
      const isoDate = "2026-09-02T18:45:19.477Z";
      const logLine = `[${isoDate}] [WARN] [AUTH_REQUIRED] [corr:${uuid}] Access denied`;

      const sanitized = sanitizeStringText(logLine);
      assert.ok(sanitized.includes(uuid), "UUID must not be masked as phone number");
      assert.ok(sanitized.includes(isoDate), "Timestamp must remain intact");
    });
  });

  describe("sanitizeLogData", () => {
    test("preserves technical IDs, UUIDs, dates, and order IDs intact", () => {
      const payload = {
        correlationId: "306f3113-d348-45b4-a60e-66edffd6f94c",
        requestId: "req-1234-5678-abcd",
        userId: "user-123",
        tenantId: "tenant-xyz",
        orderId: "2000001234567890",
        meli_item_id: "MLA123456789",
        amount: 154500.50,
        createdAt: "2026-09-02T18:45:19.477Z",
      };

      const sanitized = sanitizeLogData(payload);
      assert.equal(sanitized.correlationId, "306f3113-d348-45b4-a60e-66edffd6f94c");
      assert.equal(sanitized.requestId, "req-1234-5678-abcd");
      assert.equal(sanitized.orderId, "2000001234567890");
      assert.equal(sanitized.meli_item_id, "MLA123456789");
      assert.equal(sanitized.amount, 154500.50);
      assert.equal(sanitized.createdAt, "2026-09-02T18:45:19.477Z");
    });

    test("redacts sensitive fields recursively", () => {
      const input = {
        user: {
          email: "test@example.com",
          password: "mySecretPassword123",
          token: "APP_USR-998877665544",
        },
        api_key: "sk-1234567890abcdef",
        order: {
          id: "123",
          buyer: {
            phone: "+5491155554444",
          },
        },
      };

      const sanitized = sanitizeLogData(input);

      assert.equal(sanitized.api_key, "[REDACTED]");
      assert.equal(sanitized.user.password, "[REDACTED]");
      assert.equal(sanitized.user.token, "[REDACTED]");
      assert.equal(sanitized.user.email, "t***@example.com");
      assert.ok(sanitized.order.buyer.phone.includes("****"));
    });

    test("masks phones in explicit phone keys", () => {
      const payload = {
        from_phone: "+5491155556666",
        to_phone: "+5491177778888",
        customer_phone: "5491122223333",
        telefono: "+5491199990000",
      };

      const sanitized = sanitizeLogData(payload);

      assert.ok(!sanitized.from_phone.includes("55556666"));
      assert.ok(!sanitized.to_phone.includes("77778888"));
      assert.ok(!sanitized.customer_phone.includes("22223333"));
      assert.ok(!sanitized.telefono.includes("99990000"));

      assert.ok(sanitized.from_phone.includes("****6666"));
      assert.ok(sanitized.to_phone.includes("****8888"));
      assert.ok(sanitized.customer_phone.includes("****3333"));
      assert.ok(sanitized.telefono.includes("****0000"));
    });

    test("redacts raw payload fields", () => {
      const input = {
        raw_payload: { any: "huge blob with secrets" },
        raw_data: { some: "data" },
      };

      const sanitized = sanitizeLogData(input);
      assert.equal(sanitized.raw_payload, "[RAW_PAYLOAD_REDACTED]");
      assert.equal(sanitized.raw_data, "[RAW_PAYLOAD_REDACTED]");
    });

    test("handles circular references gracefully without crashing", () => {
      const circular: any = { name: "test" };
      circular.self = circular;

      const sanitized = sanitizeLogData(circular);
      assert.equal(sanitized.name, "test");
      assert.equal(sanitized.self, "[CIRCULAR_REFERENCE]");
    });

    test("truncates excessively long strings", () => {
      const longString = "A".repeat(1000);
      const sanitized = sanitizeLogData({ text: longString }, 6, 100);

      assert.ok(sanitized.text.length < 200);
      assert.ok(sanitized.text.includes("[TRUNCATED"));
    });
  });
});
