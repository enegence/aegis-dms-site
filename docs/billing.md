# Billing

## Plans

Two paid plans are offered:

| Plan | Who it is for | What it includes |
|---|---|---|
| **Aegis Relay** | Self-hosted Aegis Core users | Relay Monitoring: heartbeat tracking, offline detection, alert emails |
| **Aegis Hosted** | Non-technical users | Fully managed estate/contact/switch management, no Docker required |

Pricing values are **placeholders** in the alpha. The `/api/pricing` endpoint returns `price: null` and a link to the pricing page rather than hardcoded figures. Do not treat any displayed amounts as final product pricing.

## Stripe Integration

### Checkout

`POST /api/billing/checkout` initiates a Stripe Checkout session. The server creates (or reuses) a Stripe customer for the authenticated user, then returns a `checkoutUrl` for redirect. The `planId` in the request body selects the Stripe Price to check out.

### Webhooks

Stripe lifecycle events are handled at `POST /api/billing/webhook`. The raw request body is used for Stripe signature verification (`stripe.webhooks.constructEvent`). Processed events are deduplicated via the `stripe_webhook_events` table.

Events handled:

| Event | Action |
|---|---|
| `checkout.session.completed` | Create or update subscription record, link Stripe customer to user |
| `customer.subscription.updated` | Update subscription status and period fields |
| `customer.subscription.deleted` | Mark subscription as cancelled |

Subscription status values follow Stripe: `active`, `trialing`, `past_due`, `cancelled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused`.

### Subscription Lifecycle

Subscription state is tracked in the `subscriptions` table:

```
userId
stripeCustomerId
stripeSubscriptionId
stripePriceId
planId
status
currentPeriodStart
currentPeriodEnd
cancelAtPeriodEnd
```

Application features gate on subscription status. See "Subscription Gating" below.

## Billing Portal

Authenticated users can open the Stripe Customer Portal to manage their subscription (update payment method, cancel, view invoices):

```
POST /api/billing/portal
```

Auth + CSRF required. Returns `{ url: string }`. The frontend redirects to the Stripe-hosted portal. After the user is done, Stripe redirects back to the configured `returnUrl`.

If the user has no Stripe customer record yet (never started checkout), the server returns an appropriate error rather than creating a portal session.

## Alpha Pricing

Prices are placeholders during the alpha period:

- `PricingPlan.price` is `number | null`.
- If pricing is unavailable, the API returns `price: null` and an optional `pricingUrl` pointing to the pricing page.
- Do not rely on alpha pricing figures for budgeting or commitments.

## Subscription Gating

In alpha mode (`AEGIS_ALPHA_MODE=true`), subscription checks are relaxed: users can access Relay and Hosted features without an active paid subscription. This allows testing without a live Stripe integration.

In production mode, active Relay connections require a valid Relay or Hosted subscription (`active` or `trialing`). Arming a hosted switch requires the same.

The central gating helpers are in `server/src/services/subscription-gate.ts`:

```typescript
canUseRelay(db, userId): Promise<boolean>
canUseHosted(db, userId): Promise<boolean>
```

These are the single source of truth for gating decisions throughout the codebase.

## Public Pricing API

```
GET /api/pricing
```

Returns the current plan list with placeholder pricing. No authentication required. Used by the marketing pricing page.
