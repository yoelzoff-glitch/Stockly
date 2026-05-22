export type TenantPlan = 'free' | 'pro' | 'enterprise'; // derived from schema
export type TenantStatus = 'trialing' | 'active' | 'suspended' | 'cancelled';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  timezone: string;
  currency: string;
  metadata: Record<string, any>;
  created_at: Date | string;
  updated_at: Date | string;
}
