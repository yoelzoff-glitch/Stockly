# SPRINT 4: WEBHOOK THREAT MODEL & SECURITY CONTRACT AUDIT

**Document Version:** 1.0.0  
**Target:** Stockly / Klyvo API Webhook Architecture  
**Status:** Audit & Architecture Baseline  

---

## 1. Executive Summary & Audit Baseline

This document defines the security threat model, cryptographic verification standards, atomic idempotency mechanisms, and API resilience controls for external webhooks integrated with Stockly/Klyvo:
1. **Mercado Libre Webhooks** (`/api/meli/webhook`)
2. **Mercado Pago Webhooks** (`/api/mercadopago/webhook`)
3. **WhatsApp Cloud API Webhooks** (`/api/whatsapp/webhook`)

### Pre-Sprint 4 Audit Findings
- **Mercado Libre:** Unauthenticated POST handler. Relied on `req.headers.get("user-agent")`. Direct heavy operations (`syncOrders`, `syncProducts`, `syncShipments`) invoked in fire-and-forget asynchronous promises after returning HTTP responses, creating memory leaks and unhandled promise rejections. Duplicate writes into `ai_actions`.
- **Mercado Pago:** Legacy validation relied on query parameter `?secret=...`. Processing took place synchronously on the HTTP request thread, making the endpoint vulnerable to timeout and replay attacks.
- **WhatsApp:** Signature validation existed but had fallback bypass in development, parsed sender phone instead of destination business `phone_number_id` (enabling tenant spoofing), and used raw unescaped string interpolation in Supabase `.or()` filters. Heavy AI agent and media processing ran in fire-and-forget promises.
- **Idempotency & Concurrency:** No centralized persistent idempotency registry existed. Concurrent bursts of identical webhooks triggered redundant database writes, external API calls, and race conditions.

---

## 2. Threat Classification & Mitigation Matrix

| Threat ID | Threat Category | Description & Attack Vector | Mitigation Strategy in Sprint 4 |
| :--- | :--- | :--- | :--- |
| **TM-01** | Spoofing / Unauthenticated Webhook | Attacker crafts fake webhooks to inject fraudulent orders, fake subscription activations, or fake chat messages. | Cryptographic signature validation per provider (`X-Hub-Signature-256`, `x-signature` HMAC-SHA256) with timing-safe comparison (`crypto.timingSafeEqual`). |
| **TM-02** | Replay & Concurrency Storms | Attacker or provider retries identical webhook 20+ times concurrently, causing duplicate stock adjustments or duplicate billing events. | Persistent atomic `webhook_events` table with `UNIQUE(provider, event_key)` and transactional claim (`received` -> `queued` -> `processing` -> `completed`). |
| **TM-03** | Denial of Service (DoS) via Giant Payload | Attacker sends megabyte-sized JSON payloads to exhaust server memory and JSON parser CPU cycles. | Maximum body size limiting (e.g. 512KB) before JSON parsing. |
| **TM-04** | Tenant Spoofing (WhatsApp) | Attacker sends a message from a phone number pretending to be a tenant admin. | Resolve tenant exclusively by recipient WhatsApp Business Account `phone_number_id` / `display_phone_number`, never by untrusted client `message.from`. |
| **TM-05** | SQL Injection via Dynamic Filter String | WhatsApp endpoint used `.or(\`phone_number.eq."${cleanedFrom}",...\`)` without sanitization. | Safe parameterized lookups and exact match queries against `whatsapp_numbers`. |
| **TM-06** | Fire-and-Forget Process Drop | Vercel/serverless runtime terminates pending background promises immediately after HTTP response is returned. | Webhook returns immediate HTTP 200 acknowledgment after enqueueing persistent event to Inngest for guaranteed asynchronous execution. |
| **TM-07** | Rate Limit Cascade (Mercado Libre API) | Spike in webhook events triggers hundreds of simultaneous Meli REST calls, causing 429 cascades. | Inngest concurrency throttling per tenant, exponential backoff with jitter in `meliFetch`, and respect of `Retry-After` headers. |
| **TM-08** | PII & Secret Leakage in Telemetry | Raw bodies containing user messages, payment details, or access tokens printed in server logs. | Sanitized logging: mask PII, tokens, and raw secrets; log only correlation IDs, event keys, and sanitized metadata. |

---

## 3. Webhook Contract Specifications

### 3.1 WhatsApp Cloud API Webhook
- **GET (Verification):**
  - Query params: `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`.
  - Returns `hub.challenge` string if `hub.verify_token === process.env.WHATSAPP_VERIFY_TOKEN`.
- **POST (Event Notification):**
  - Header: `X-Hub-Signature-256: sha256=<hex>`
  - Algorithm: HMAC-SHA256(`rawBody`, `WHATSAPP_APP_SECRET`).
  - Verification: `crypto.timingSafeEqual`.
  - Tenant Resolution: `entry[].changes[].value.metadata.phone_number_id` mapped to `whatsapp_numbers.phone_number_id` / `whatsapp_numbers.phone_number`.
  - Event Key Strategy: `wa_${message.id}` (or `wa_${entry.id}_${changes[0].value.messages[0].id}`).

### 3.2 Mercado Pago Webhook
- **POST (Event Notification):**
  - Headers:
    - `x-signature: ts=<ts>,v1=<hash>`
    - `x-request-id: <uuid>`
  - Algorithm: HMAC-SHA256(`id:${dataId};request-id:${xRequestId};ts:${ts};`, `MP_WEBHOOK_SECRET` / `MERCADOPAGO_WEBHOOK_SECRET`).
  - Verification: `crypto.timingSafeEqual`.
  - Fallback in `observe` mode: Transitional verification of query param `?secret=...`.
  - Event Key Strategy: `mp_${topic}_${resourceId}_${ts || Date.now()}`.

### 3.3 Mercado Libre Webhook
- **POST (Event Notification):**
  - Payload: `{ topic, resource, user_id, application_id, attempts, sent, received }`
  - Tenant Resolution: `user_id` mapped to `meli_accounts.meli_user_id`.
  - Verification: Signature verification when configured (`x-signature` / `x-meli-signature`) + authenticated resource verification via `meliFetch`.
  - Event Key Strategy: `meli_${topic}_${resource.replace(/\//g, '_')}_${received || sent || Date.now()}`.

---

## 4. Rollout Strategy & Zero-Downtime Guarantee

1. **Dual Verification Modes:**
   - `MELI_WEBHOOK_SIGNATURE_MODE=observe|enforce` (Default: `observe`)
   - `MP_WEBHOOK_SIGNATURE_MODE=observe|enforce` (Default: `observe`)
   - `WHATSAPP_WEBHOOK_SIGNATURE_MODE=observe|enforce` (Default: `observe`)
2. **Safety Kill-Switches:**
   - `KLYVO_DISABLE_WHATSAPP_AGENT=true` preserved.
   - `strict_tenant_authorization=false` preserved for backwards compatibility.
3. **Audit Gates:**
   - Static webhook audit script (`scripts/audit-webhooks.ts`).
   - Unit tests for cryptographic signatures and timing attacks (`tests/unit/webhookSignatures.test.ts`).
   - Integration tests against local PostgreSQL for concurrency and idempotency (`tests/integration/webhookIdempotency.test.ts`).
