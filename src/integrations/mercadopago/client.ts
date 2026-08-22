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
    title: 'Klyvo Starter ($49.99 USD)',
    price: 78984, // Equiv ARS a $1580 * 49.99
    promoPrice: 78984,
    trialDays: 15,
  },
  pro: {
    title: 'Klyvo Pro ($79.99 USD)',
    price: 126384, // Equiv ARS a $1580 * 79.99
    promoPrice: 126384,
    trialDays: 15,
  },
  ultra: {
    title: 'Klyvo Ultra ($129.99 USD)',
    price: 205384, // Equiv ARS a $1580 * 129.99
    promoPrice: 205384,
    trialDays: 0,
  }
};

export async function updateSubscriptionAmount(id: string, amount: number) {
  try {
    const response = await preApproval.update({ id, body: { transaction_amount: amount } as any });
    return response;
  } catch (error: any) {
    logger.error(`Error updating MP subscription amount ${id} to ${amount}: ${error.message}`, "MERCADOPAGO");
    throw error;
  }
}

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
      let url = "https://klyvo.com"; // Fallback para dev porque MP exige HTTPS válido
      if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")) {
        url = process.env.NEXTAUTH_URL.replace(/["']/g, "").replace(/\/$/, "");
      } else if (process.env.VERCEL_URL) {
        url = `https://${process.env.VERCEL_URL}`;
      }
      return url;
    };

    const backUrlPath = referenceType === 'user' ? '/onboarding' : '/dashboard/billing';

    const autoRecurring: any = {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: planDetails.price,
      currency_id: 'ARS',
    };

    if (planDetails.trialDays > 0) {
      autoRecurring.free_trial = {
        frequency: planDetails.trialDays,
        frequency_type: 'days'
      };
    }

    const response = await preApproval.create({
      body: {
        reason: planDetails.title,
        auto_recurring: autoRecurring,
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

export async function cancelSubscription(id: string) {
  try {
    const response = await preApproval.update({ id, body: { status: "cancelled" } });
    return response;
  } catch (error: any) {
    logger.error(`Error cancelling MP subscription ${id}: ${error.message}`, "MERCADOPAGO");
    throw error;
  }
}
