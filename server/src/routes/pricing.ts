import type { FastifyInstance } from 'fastify';
import type { PricingResponse } from '@aegis-site/shared';

export async function pricingRoutes(app: FastifyInstance) {
  app.get('/api/pricing', async (_req, reply) => {
    const relayPrice = process.env.AEGIS_RELAY_DISPLAY_PRICE
      ? parseInt(process.env.AEGIS_RELAY_DISPLAY_PRICE, 10)
      : null;
    const hostedPrice = process.env.AEGIS_HOSTED_DISPLAY_PRICE
      ? parseInt(process.env.AEGIS_HOSTED_DISPLAY_PRICE, 10)
      : null;

    const response: PricingResponse = {
      plans: [
        {
          id: 'relay',
          name: 'Aegis Relay',
          price: relayPrice,
          currency: 'usd',
          interval: 'month',
          features: [
            'Cloud heartbeat monitoring',
            'Offline host alerts',
            'Reliable notification delivery',
            'Hosted claim portal',
            'Escalation timers',
            'Delivery receipts',
          ],
          pricingUrl: 'https://aegisdms.life/pricing',
        },
        {
          id: 'hosted',
          name: 'Aegis Hosted',
          price: hostedPrice,
          currency: 'usd',
          interval: 'month',
          features: [
            'Everything in Relay',
            'Fully managed dashboard',
            'Managed encrypted storage',
            'No Docker required',
            'No SMTP/Telegram setup',
            'Priority support',
            'Helper Pack (coming soon)',
          ],
          pricingUrl: 'https://aegisdms.life/pricing',
        },
      ],
    };

    return reply.send(response);
  });
}
