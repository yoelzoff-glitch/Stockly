export type AIActionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AIAction {
  id: string;
  tenant_id: string;
  message_id?: string;
  action_type: string;
  status: AIActionStatus;
  title: string;
  description?: string;
  payload: Record<string, any>;
  result?: Record<string, any>;
  requested_by?: string;
  confirmed_by?: string;
  confirmed_at?: Date | string;
  executed_at?: Date | string;
  failed_reason?: string;
  created_at: Date | string;
  updated_at: Date | string;
}
