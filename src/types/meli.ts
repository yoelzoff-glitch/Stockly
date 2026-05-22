export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface MeliAccount {
  id: string;
  tenant_id: string;
  meli_user_id: string;
  nickname?: string;
  site_id?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date | string;
  status: IntegrationStatus;
  last_sync_at?: Date | string;
  sync_error?: string;
  metadata: Record<string, any>;
  created_at: Date | string;
  updated_at: Date | string;
}
