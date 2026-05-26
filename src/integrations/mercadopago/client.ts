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
  starter: {
    title: 'Stockly Starter ($44 USD)',
    price: 65560, // Equiv ARS a $1490 * 44
  },
  pro: {
    title: 'Stockly Pro ($79 USD)',
    price: 117710, // Equiv ARS a $1490 * 79
  },
  ultra: {
    title: 'Stockly Ultra ($129 USD)',
    price: 192210, // Equiv ARS a $1490 * 129
  }
};

export async function createSubscriptionPreference(
  referenceId: string, 
  plan: 'starter' | 'pro' | 'ultra', 
  userEmail: string,
  referenceType: 'user' | 'tenant' = 'tenant'
) {
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

    const backUrlPath = referenceType === 'user' ? '/onboarding' : '/dashboard/billing';

    const response = await preApproval.create({
      body: {
        reason: planDetails.title,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: planDetails.price,
          currency_id: 'ARS',
        },
        back_url: `${getBaseUrl()}${backUrlPath}?success=true`,
        payer_email: userEmail,
        external_reference: `${referenceType}_${referenceId}`, // To identify the tenant or user when webhook arrives
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
