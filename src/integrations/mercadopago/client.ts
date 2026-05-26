import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { logger } from "@/lib/errors/logger";

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  logger.warn("MERCADOPAGO_ACCESS_TOKEN is missing. Billing features will not work properly.");
}

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-0000000000",
  options: { timeout: 10000 }
});

const preApproval = new PreApproval(client);

const PLANS = {
  pro: {
    title: 'Stockly Pro ($49 USD)',
    price: 73000, // Equiv ARS a $1490
  },
  ultra: {
    title: 'Stockly Ultra ($89 USD)',
    price: 132600, // Equiv ARS a $1490
  }
};

export async function createSubscriptionPreference(tenantId: string, plan: 'pro' | 'ultra', userEmail: string) {
  try {
    const planDetails = PLANS[plan];
    if (!planDetails) throw new Error("Plan not found");

    const getBaseUrl = () => {
      if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL.replace(/["']/g, "").replace(/\/$/, "");
      }
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
      }
      return "http://localhost:3000";
    };

    const response = await preApproval.create({
      body: {
        reason: planDetails.title,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: planDetails.price,
          currency_id: 'ARS',
        },
        back_url: `${getBaseUrl()}/dashboard/billing?success=true`,
        payer_email: userEmail,
        external_reference: tenantId, // To identify the tenant when webhook arrives
      }
    });

    return response.init_point;
  } catch (error: any) {
    logger.error(`Error creating MP subscription: ${error.message}`, "MERCADOPAGO");
    throw error;
  }
}

export async function getSubscription(id: string) {
  try {
    const response = await preApproval.get({ id });
    return response;
  } catch (error: any) {
    logger.error(`Error getting MP subscription ${id}: ${error.message}`, "MERCADOPAGO");
    throw error;
  }
}
