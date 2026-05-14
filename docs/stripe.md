# Stripe Setup Guide

This guide covers configuring Stripe for Aegis DMS Site billing.

---

## Products and Prices

Two products must be created in the Stripe Dashboard (or via the Stripe CLI):

| Product | Description | Price ID env var |
|---|---|---|
| **Aegis Relay** | Cloud relay monitoring for self-hosted Aegis Core users | `STRIPE_RELAY_PRICE_ID` |
| **Aegis Hosted** | Fully managed estate/contact/switch management | `STRIPE_HOSTED_PRICE_ID` |

Pricing amounts are **placeholders** in the alpha. Create the prices with reasonable placeholder amounts; they will be updated before public launch.

### Creating products in the Stripe Dashboard

1. Go to **Stripe Dashboard** → **Product catalog** → **+ Add product**.
2. Create **Aegis Relay**:
   - Name: `Aegis Relay`
   - Pricing model: Recurring, monthly
   - Amount: placeholder (e.g. $9.00/month)
   - Copy the generated **Price ID** (e.g. `price_1ABC...`) → set as `STRIPE_RELAY_PRICE_ID`
3. Create **Aegis Hosted**:
   - Name: `Aegis Hosted`
   - Pricing model: Recurring, monthly
   - Amount: placeholder (e.g. $19.00/month)
   - Copy the generated **Price ID** → set as `STRIPE_HOSTED_PRICE_ID`

> Use `price_placeholder_relay` and `price_placeholder_hosted` as values in development/CI if no live Stripe account is configured.

---

## Webhook Endpoint

### Endpoint URL

```
https://your-domain.com/api/billing/webhook
```

Replace `your-domain.com` with the value of `AEGIS_BASE_URL` (without trailing slash).

### Registering the webhook

1. In **Stripe Dashboard** → **Developers** → **Webhooks** → **+ Add endpoint**.
2. Set the endpoint URL above.
3. Select the following events:

| Event | Purpose |
|---|---|
| `checkout.session.completed` | Record completed checkout, link Stripe customer to user |
| `customer.subscription.created` | Initial subscription record creation |
| `customer.subscription.updated` | Handle plan changes, renewal, past_due, cancellation scheduling |
| `customer.subscription.deleted` | Mark subscription as cancelled |

4. Click **Add endpoint**.
5. Copy the **Signing secret** (`whsec_...`) → set as `STRIPE_WEBHOOK_SECRET`.

> The server uses `stripe.webhooks.constructEvent` with the raw request body. Do not use middleware that buffers or transforms the body before the webhook route — this will break signature verification.

---

## Local Webhook Testing

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe listen --forward-to localhost:8001/api/billing/webhook
```

The CLI will print a temporary webhook signing secret. Set it as `STRIPE_WEBHOOK_SECRET` in your local `.env` while the listener is running.

To trigger a test event:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

## Customer Portal Setup

The Stripe Customer Portal allows users to manage their subscription without writing custom billing UI.

### Enabling the portal

1. In **Stripe Dashboard** → **Settings** → **Billing** → **Customer portal**.
2. Enable the portal.
3. Configure allowed actions (recommended for alpha):
   - Cancel subscription: allowed
   - Update payment method: allowed
   - View invoices: allowed
   - Change plan: optional
4. Set the **Return URL** to `https://your-domain.com/app/billing` (or wherever the billing page lives in your app).
5. Save settings.

The server creates portal sessions at `POST /api/billing/portal` (auth + CSRF required). It returns `{ url: string }` and the frontend redirects the user to the Stripe-hosted portal.

---

## Failure Modes

### Webhook signature failure

**Symptom:** `Stripe webhook signature invalid` in logs; webhook events not processed.

**Causes:**
- `STRIPE_WEBHOOK_SECRET` is wrong or is the test-mode CLI secret when the endpoint expects the dashboard secret (or vice versa).
- Request body was parsed/buffered before reaching the webhook route.
- Stripe is sending to the wrong endpoint URL.

**Fix:** Verify the signing secret matches the endpoint registration. Confirm the raw body is passed to `stripe.webhooks.constructEvent`.

### Missing customer

**Symptom:** Billing portal returns error: user has no Stripe customer record.

**Cause:** User never completed a Checkout session (or `checkout.session.completed` webhook was missed/failed).

**Fix:** Check the `subscriptions` table for the user. If missing, check Railway logs for webhook failures around the time of checkout. Replay the event from the Stripe Dashboard → Webhooks → endpoint → **Send test webhook** or find the event and click **Resend**.

### Double subscription

**Symptom:** User has two active subscription records.

**Cause:** Webhook delivered twice (e.g. network retry) and deduplication logic failed.

**Fix:** Check the `stripe_webhook_events` table for duplicate event IDs. The webhook handler deduplicates by Stripe event ID. If a duplicate slipped through, manually cancel the extra subscription in Stripe Dashboard and correct the `subscriptions` row.

### Subscription gating in alpha mode

In alpha mode (`AEGIS_ALPHA_MODE=true`), subscription checks are relaxed. Users can access Relay and Hosted features without an active paid subscription. Set `AEGIS_ALPHA_MODE=false` in production to enforce gating.
