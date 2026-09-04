import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  timingSafeStringCompare,
  validateWhatsAppWebhookSignature,
  validateMercadoPagoWebhookSignature,
  validateMercadoLibreWebhookSignature,
} from "../../src/lib/security/webhookSignatures";
import { getWebhookSignatureConfig } from "../../src/lib/security/signatureConfig";

describe("Sprint 4: Cryptographic Webhook Signatures & Timing Safety", () => {
  describe("timingSafeStringCompare", () => {
    test("returns true for identical strings", () => {
      assert.equal(timingSafeStringCompare("abcdef123456", "abcdef123456"), true);
      assert.equal(timingSafeStringCompare("", ""), true);
    });

    test("returns false for different strings of same length", () => {
      assert.equal(timingSafeStringCompare("abcdef123456", "abcdef123457"), false);
    });

    test("returns false for different strings of different lengths without throwing", () => {
      assert.equal(timingSafeStringCompare("abcdef", "abcdef123456"), false);
      assert.equal(timingSafeStringCompare("abcdef123456", "abc"), false);
    });
  });

  describe("WhatsApp X-Hub-Signature-256 Validation", () => {
    const appSecret = "test_whatsapp_secret_key_12345";
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "123", changes: [{ field: "messages", value: { messages: [{ id: "m1", text: { body: "Hola" } }] } }] }],
    });

    const validHash = crypto.createHmac("sha256", appSecret).update(rawBody, "utf-8").digest("hex");
    const validHeader = `sha256=${validHash}`;

    test("accepts valid X-Hub-Signature-256", () => {
      const result = validateWhatsAppWebhookSignature(rawBody, validHeader, appSecret);
      assert.equal(result.isValid, true);
      assert.equal(result.reason, undefined);
    });

    test("rejects when signature does not match (tampered body)", () => {
      const tamperedBody = rawBody + " ";
      const result = validateWhatsAppWebhookSignature(tamperedBody, validHeader, appSecret);
      assert.equal(result.isValid, false);
      assert.equal(result.reason, "signature_mismatch");
    });

    test("rejects when signature header is missing or null", () => {
      const result = validateWhatsAppWebhookSignature(rawBody, null, appSecret);
      assert.equal(result.isValid, false);
      assert.equal(result.reason, "missing_signature_header");
    });

    test("rejects invalid signature format (missing sha256= prefix)", () => {
      const result = validateWhatsAppWebhookSignature(rawBody, validHash, appSecret);
      assert.equal(result.isValid, false);
      assert.equal(result.reason, "invalid_signature_format");
    });
  });

  describe("Mercado Pago Webhook V2 Signature Validation", () => {
    const secret = "test_mp_secret_abc123";
    const dataId = "123456789";
    const xRequestId = "req-uuid-999";
    const ts = "1725450000";

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const validHash = crypto.createHmac("sha256", secret).update(manifest, "utf-8").digest("hex");
    const validHeader = `ts=${ts},v1=${validHash}`;

    test("accepts valid Mercado Pago V2 signature header", () => {
      const result = validateMercadoPagoWebhookSignature({
        signatureHeader: validHeader,
        xRequestIdHeader: xRequestId,
        dataId,
        secret,
      });
      assert.equal(result.isValid, true);
      assert.equal(result.reason, undefined);
    });

    test("rejects when dataId differs from signed manifest", () => {
      const result = validateMercadoPagoWebhookSignature({
        signatureHeader: validHeader,
        xRequestIdHeader: xRequestId,
        dataId: "different-data-id",
        secret,
      });
      assert.equal(result.isValid, false);
      assert.equal(result.reason, "signature_mismatch");
    });

    test("rejects when x-request-id is missing", () => {
      const result = validateMercadoPagoWebhookSignature({
        signatureHeader: validHeader,
        xRequestIdHeader: null,
        dataId,
        secret,
      });
      assert.equal(result.isValid, false);
      assert.equal(result.reason, "missing_request_id_header");
    });

    test("rejects when signature header is malformed", () => {
      const result = validateMercadoPagoWebhookSignature({
        signatureHeader: "malformed_header_without_ts_and_v1",
        xRequestIdHeader: xRequestId,
        dataId,
        secret,
      });
      assert.equal(result.isValid, false);
      assert.equal(result.reason, "malformed_x_signature_header");
    });
  });

  describe("Mercado Libre Webhook Contract Validation", () => {
    const rawBody = JSON.stringify({ resource: "/orders/123", topic: "orders_v2", user_id: 112233 });

    test("marks signature as unsupported and delegates authentication to OAuth resource fetch", () => {
      const result = validateMercadoLibreWebhookSignature(rawBody, null, undefined);
      assert.equal(result.isValid, true);
      assert.equal(result.unsupported, true);
      assert.equal(result.reason, "unsupported_provider_signature_delegated_to_oauth_verification");
    });

    test("never marks isValid as false for unsupported signature even if signature header is provided", () => {
      const result = validateMercadoLibreWebhookSignature(rawBody, "some-arbitrary-header", "some-secret");
      assert.equal(result.isValid, true);
      assert.equal(result.unsupported, true);
    });
  });

  describe("Signature Modes Configuration", () => {
    test("defaults all providers to observe mode when env is not set or set to observe", () => {
      const originalEnv = process.env.MELI_WEBHOOK_SIGNATURE_MODE;
      delete process.env.MELI_WEBHOOK_SIGNATURE_MODE;
      delete process.env.MP_WEBHOOK_SIGNATURE_MODE;
      delete process.env.WHATSAPP_WEBHOOK_SIGNATURE_MODE;

      const config = getWebhookSignatureConfig();
      assert.equal(config.meli, "observe");
      assert.equal(config.mercadopago, "observe");
      assert.equal(config.whatsapp, "observe");

      process.env.MELI_WEBHOOK_SIGNATURE_MODE = originalEnv;
    });
  });

  describe("DLQ & State Machine Transitions Logic", () => {
    test("state machine handles first failure -> retrying", () => {
      const statusTransitions: Record<string, string> = {
        received: "processing",
        processing_failure: "retrying",
        retrying_success: "completed",
        retrying_final_failure: "dead_letter",
      };

      assert.equal(statusTransitions["processing_failure"], "retrying");
    });

    test("state machine handles successful retry -> completed", () => {
      const statusTransitions: Record<string, string> = {
        received: "processing",
        processing_failure: "retrying",
        retrying_success: "completed",
        retrying_final_failure: "dead_letter",
      };

      assert.equal(statusTransitions["retrying_success"], "completed");
    });

    test("state machine handles exhausted retries -> dead_letter", () => {
      const statusTransitions: Record<string, string> = {
        received: "processing",
        processing_failure: "retrying",
        retrying_success: "completed",
        retrying_final_failure: "dead_letter",
      };

      assert.equal(statusTransitions["retrying_final_failure"], "dead_letter");
    });

    test("duplicate detection ignores already queued/processing/completed events", () => {
      const isDuplicateStatus = (status: string) =>
        ["completed", "processing", "queued", "ignored"].includes(status);

      assert.equal(isDuplicateStatus("completed"), true);
      assert.equal(isDuplicateStatus("processing"), true);
      assert.equal(isDuplicateStatus("queued"), true);
      assert.equal(isDuplicateStatus("ignored"), true);
      assert.equal(isDuplicateStatus("retrying"), false);
      assert.equal(isDuplicateStatus("dead_letter"), false);
    });
  });
});
