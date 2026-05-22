export interface AlertRule {
  id: string;
  tenant_id: string;
  name: string;
  rule_type: string;
  conditions: Record<string, any>;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Alert {
  id: string;
  tenant_id: string;
  alert_rule_id?: string;
  product_id?: string;
  title: string;
  body?: string;
  severity: string; // e.g., 'info'
  is_read: boolean;
  created_at: Date | string;
}
