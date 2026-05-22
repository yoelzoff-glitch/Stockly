export interface WhatsAppConfig {
  phoneNumberId: string;
  token: string;
}

export class WhatsAppAPI {
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  async sendMessage(to: string, message: string) {
    // Placeholder for WhatsApp Cloud API sending message
    console.log(`Sending WhatsApp message to ${to}: ${message}`);
    return true;
  }
}
