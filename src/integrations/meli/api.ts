export interface MeliConfig {
  accessToken: string;
  refreshToken?: string;
  sellerId: string;
}

export class MeliAPI {
  private config: MeliConfig;

  constructor(config: MeliConfig) {
    this.config = config;
  }

  async getOrders() {
    // Placeholder for Mercado Libre orders API
    return [];
  }

  async getProducts() {
    // Placeholder for Mercado Libre products API
    return [];
  }
}
