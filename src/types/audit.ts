export interface AuditLog {
  id: string;
  tenant_id?: string;
  actor_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  description?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date | string;
}
