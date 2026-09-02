import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeLogData, maskEmail, maskPhone } from "../../src/lib/observability/sanitizer";

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
    });
  });

  describe("sanitizeLogData", () => {
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
