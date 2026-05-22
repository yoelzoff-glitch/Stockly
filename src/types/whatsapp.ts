export interface WhatsAppNumber {
  id: string;
  tenant_id: string;
  phone_number: string;
  provider: string; // default: 'meta'
  provider_phone_id?: string;
  access_token?: string;
  status: string; // IntegrationStatus from meli.ts conceptually
  metadata: Record<string, any>;
  created_at: Date | string;
  updated_at: Date | string;
}
