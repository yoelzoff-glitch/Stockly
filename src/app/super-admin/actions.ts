"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/security/platformAdminAuth";
import {
  assignPlan,
  changePlan,
  extendTrial,
  activateSubscription,
  pauseSubscription,
  reactivateSubscription,
  cancelSubscription,
  CancellationReason,
} from "@/services/super-admin/subscriptions";

export async function handleAssignPlan(
  tenantId: string,
  planId: string,
  billingInterval: "monthly" | "yearly" = "monthly",
  isTrial: boolean = false,
  trialDays: number = 14
) {
  const admin = await requirePlatformAdmin();
  const res = await assignPlan(
    admin.userId,
    tenantId,
    planId,
    billingInterval,
    isTrial,
    trialDays
  );
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin");
  return res;
}

export async function handleChangePlan(tenantId: string, newPlanId: string) {
  const admin = await requirePlatformAdmin();
  const res = await changePlan(admin.userId, tenantId, newPlanId);
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin");
  return res;
}

export async function handleExtendTrial(tenantId: string, additionalDays: number) {
  const admin = await requirePlatformAdmin();
  const res = await extendTrial(admin.userId, tenantId, additionalDays);
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin");
  return res;
}

export async function handleActivateSubscription(tenantId: string) {
  const admin = await requirePlatformAdmin();
  const res = await activateSubscription(admin.userId, tenantId);
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin");
  return res;
}

export async function handlePauseSubscription(tenantId: string) {
  const admin = await requirePlatformAdmin();
  const res = await pauseSubscription(admin.userId, tenantId);
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin");
  return res;
}

export async function handleReactivateSubscription(tenantId: string) {
  const admin = await requirePlatformAdmin();
  const res = await reactivateSubscription(admin.userId, tenantId);
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin");
  return res;
}

export async function handleCancelSubscription(
  tenantId: string,
  reason: CancellationReason = "other",
  comment?: string,
  immediate: boolean = false
) {
  const admin = await requirePlatformAdmin();
  const res = await cancelSubscription(admin.userId, tenantId, reason, comment, immediate);
  revalidatePath(`/super-admin/customers/${tenantId}`);
  revalidatePath("/super-admin/customers");
  revalidatePath("/super-admin/cancellations");
  revalidatePath("/super-admin");
  return res;
}

export async function checkIsPlatformAdminAction(): Promise<boolean> {
  const { isPlatformAdmin } = await import("@/lib/security/platformAdminAuth");
  return isPlatformAdmin();
}
