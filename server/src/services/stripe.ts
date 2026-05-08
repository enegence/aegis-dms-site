import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(secretKey: string): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeInstance;
}

export async function createCheckoutSession(
  stripe: Stripe,
  params: {
    customerId?: string;
    customerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId || undefined,
    customer_email: params.customerId ? undefined : params.customerEmail,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });

  return session.url!;
}

export async function createPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
