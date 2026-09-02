# Paystack setup

Kobby's Kitchen uses Paystack Hosted Checkout. Card and Mobile Money details are collected only by Paystack; the application never receives raw card details.

## Environment variables

Configure these separately in Development, Preview, and Production as appropriate:

- `PAYSTACK_SECRET_KEY` — server-only Paystack secret key. Production uses Live
  mode; Development uses Test mode.
- `PAYSTACK_ENABLED` — `true` only when the corresponding key and dashboard setup are ready.
- `ONLINE_PAYMENT_REQUIRED` — `true` for the current Production policy. Normal
  customers use Paystack; allowlisted customers can still choose Paystack or
  Cash on Pickup.
- `CASH_ON_PICKUP_ALLOWED_EMAILS` — optional comma-separated, server-only trusted
  account list. Blank or missing fails closed.
- `AUTH_URL` — canonical application origin used to build the trusted callback URL.

Never prefix the secret key or Cash allowlist with `NEXT_PUBLIC_`. This Hosted
Checkout architecture does not use a Paystack public key.

## Dashboard routes

- Webhook: `https://kobbys-kitchen.vercel.app/api/payments/paystack/webhook`
- Callback: `https://kobbys-kitchen.vercel.app/api/payments/paystack/callback`
- Initial order/payment: `POST /api/orders`
- Retry initialization: `POST /api/payments/paystack/initialize`

The application also supplies the callback URL when initializing each hosted transaction. A callback never proves payment; the server verifies the Paystack transaction before updating an order.

## Acceptance and operations

1. Configure a Paystack test secret in Development and set `PAYSTACK_ENABLED=true`.
2. Configure the webhook URL in the Paystack test dashboard.
3. Complete one Mobile Money test and one Card test, including callback, webhook, receipt, retry, and refund acceptance.
4. Configure the Production Live secret, flags, canonical Auth URL, and webhook.
5. Complete one controlled, low-value live Production transaction without
   manually changing its state. Confirm callback verification, signed webhook,
   exact amount/currency, PAID state, one Receipt, and normal order operations.
6. Refund only when the business acceptance procedure explicitly calls for it.

Production configuration is Live, but the first genuine/live transaction remains
pending acceptance. Do not initiate a charge from an automated audit.
