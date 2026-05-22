export type MessageChannel = 'whatsapp' | 'web'; // Assuming other channels might exist
export type MessageDirection = 'inbound' | 'outbound';

export interface Message {
  id: string;
  tenant_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  from_phone?: string;
  to_phone?: string;
  text?: string;
  audio_url?: string;
  transcription?: string;
  intent?: string;
  confidence?: number;
  ai_response?: string;
  raw_payload: Record<string, any>;
  created_at: Date | string;
}
