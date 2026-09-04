# SPRINT 5: BILLING INVENTORY, ENTITLEMENTS & SNAPSHOT AUDIT

**Document Version:** 1.0.0  
**Target:** Stockly / Klyvo Billing & Subscription Architecture  
**Status:** Audit & Architecture Baseline  

---

## 1. Executive Summary & Existing State

This document audits the billing, plans, quotas, and subscription state of Stockly/Klyvo before implementing Sprint 5 changes:
1. **Existing Plans:** `starter`, `pro`, `ultra` (with legacy references to `free` and `business` normalized to `starter` and `ultra` respectively).
2. **Subscriptions Source of Truth:** `subscriptions` table is established as the sole canonical source of truth for plan, status, and expiration. `tenants.plan` remains as a synchronized compatibility mirror.
3. **Active Production Tenant Protection:** The existing active tenant and real user will retain their current plan, expiration date, and uninterrupted dashboard access throughout this rollout.

---

## 2. Plan Specifications & Dynamic Limits Matrix

All limits are stored dynamically in `plans_config` and cached with a 5-minute TTL:

| Plan Key | Display Name | AI Credits / Month | Automation Actions / Month | WhatsApp Messages / Month | SKU Publications Limit | Monthly Price (ARS) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`starter`** | Klyvo Starter | 500 | 250 | 300 | 100 | $78,984 |
| **`pro`** | Klyvo Pro | 1,500 | 800 | 1,500 | 400 | $126,384 |
| **`ultra`** | Klyvo Ultra | 5,000 | 1,500 | 5,000 | 1,000 | $205,384 |

### Legacy Aliases & Normalization
- `free` $\rightarrow$ Normalized to `starter` limits with read-only/grace protection.
- `business` $\rightarrow$ Normalized to `ultra` limits.

---

## 3. Subscription Statuses & Entitlement Access Modes

The central resolver `resolveTenantEntitlements(tenantId)` maps subscription rows to exact access modes:

| Database Status | Expiration Condition | Computed `accessMode` | Description & Enforcement |
| :--- | :--- | :--- | :--- |
| **`active`** | `expires_at IS NULL` OR `expires_at > NOW()` | **`active`** | Full access to plan limits. |
| **`trialing`** | `expires_at > NOW()` | **`active`** | Active trial access with plan limits. |
| **`active` / `trialing`** | `expires_at <= NOW()` (within 3 days) | **`grace`** | 3-day grace period. Banner shown, full operational access preserved. |
| **`past_due`** | Payment failed in MP | **`grace`** | Grace period while MP attempts automatic retries. |
| **`cancelled`** | `expires_at > NOW()` | **`active`** | Preserves paid access until current period ends. |
| **`cancelled`** | `expires_at <= NOW()` | **`read_only`** | Read-only access to existing data; modifications and quota consumption blocked. |
| **`expired`** | `expires_at <= NOW() - 3 days` | **`blocked`** | Access restricted to `/dashboard/billing` for reactivation. |

---

## 4. Quota Consumption Anti-Pattern Elimination

### Previous Vulnerability (Race Condition)
```typescript
// ❌ INSECURE ANTI-PATTERN (SPRINT 4 AND EARLIER)
const { data: usage } = await supabase.from("subscription_usage").select("*").eq("tenant_id", tenantId).single();
const newValue = (usage?.ai_credits_used || 0) + amount;
await supabase.from("subscription_usage").update({ ai_credits_used: newValue }).eq("id", usage.id);
```
- **Flaw:** Concurrent requests read the same initial usage and overwrite each other's increments, resulting in lost counts and quota bypass.

### Sprint 5 Solution (Atomic Database Transaction & Ledger)
```sql
-- ✅ ATOMIC FUNCTION WITH FOR UPDATE LOCKING & UNIQUE IDEMPOTENCY KEY
SELECT * FROM public.consume_tenant_quota(
  p_tenant_id := '...',
  p_metric := 'ai_credits_used',
  p_amount := 1,
  p_idempotency_key := 'req_abc123',
  p_source := 'ai_chat',
  p_correlation_id := 'corr_xyz'
);
```
- Locks the monthly row using `FOR UPDATE`.
- Enforces unique `(tenant_id, metric, idempotency_key)` in `usage_events`.
- Rejects requests when usage exceeds limit without allowing negative counters.

---

## 5. Mercado Pago Lifecycle & Webhook Deduplication Strategy

1. **Notification Identification Priority:**
   - Priority 1: Notification ID in payload (`id` / `notification_id`).
   - Priority 2: Composite SHA-256 hash `hash(type:action:data.id:date_created)`.
2. **State Updates:**
   - The background worker queries Mercado Pago with server-side OAuth credentials (`getSubscription(resourceId)`).
   - `expires_at` is set using real dates (`next_payment_date`) from Mercado Pago, never blindly computed as `Date.now() + 30 days`.
   - Out-of-order events (older `date_created`) are rejected from overriding newer states.
3. **Safe Downgrades:**
   - Downgrades set `pending_plan` without deleting products, SKU components, or history.
   - If SKU count exceeds the target plan limit, existing products are preserved, but adding new SKUs is blocked until usage is within limits.
