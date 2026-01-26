# Stripe Payment Integration — Setup Guide

## 1. Stripe Dashboard Configuration

- Create a new Product (e.g., "Satuso Standard")
- Add a recurring Price: **$29/month**
- Copy the Price ID (starts with `price_`)

## 2. Set Cloudflare Secrets

```bash
wrangler secret put STRIPE_SECRET_KEY
# Paste your Stripe secret key (sk_live_... or sk_test_...)

wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste the webhook signing secret (whsec_...) — created in step 3

wrangler secret put STRIPE_PRICE_ID
# Paste the price ID (price_...)
```

## 3. Create Stripe Webhook Endpoint

- Go to **Stripe Dashboard > Developers > Webhooks**
- Add endpoint: `https://app.satuso.com/api/billing/webhook`
- Select events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy the signing secret and use it in step 2

## 4. Configure Stripe Customer Portal

- Go to **Stripe Dashboard > Settings > Customer portal**
- Enable: subscription cancellation, payment method updates, invoice history
- Set the default return URL to `https://app.satuso.com/settings`

## 5. Test the Flow

1. Sign up as a new user — should land on `/subscribe`
2. Click Subscribe — should redirect to Stripe Checkout
3. Complete test payment (use card `4242 4242 4242 4242`)
4. Should redirect to `/billing/success`, poll until active, then go to dashboard
5. Go to **Settings > Billing > "Manage Billing"** — should open Stripe Portal
6. Cancel subscription in portal — should be redirected back to `/subscribe`
