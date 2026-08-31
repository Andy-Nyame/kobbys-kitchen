# Paystack setup

Kobby's Kitchen uses Paystack Hosted Checkout. Card and Mobile Money details are collected only by Paystack; the application never receives raw card details.

## Environment variables

Configure these separately in Development, Preview, and Production as appropriate:

- `PAYSTACK_SECRET_KEY` — server-only Paystack secret key (test key outside live acceptance).
- `PAYSTACK_ENABLED` — `true` only when the corresponding key and dashboard setup are ready.
- `ONLINE_PAYMENT_REQUIRED` — keep `false` until a controlled live payment has passed. When `true`, Cash at Pickup remains visible but unavailable for new online orders.
- `AUTH_URL` — canonical application origin used to build the trusted callback URL.

Never prefix the secret key with `NEXT_PUBLIC_`.

## Dashboard routes

- Webhook: `https://kobbys-kitchen.vercel.app/api/payments/paystack/webhook`
- Callback: `https://kobbys-kitchen.vercel.app/api/payments/paystack/callback`

The application also supplies the callback URL when initializing each hosted transaction. A callback never proves payment; the server verifies the Paystack transaction before updating an order.

## Safe activation order

1. Configure a Paystack test secret in Development and set `PAYSTACK_ENABLED=true`.
2. Configure the webhook URL in the Paystack test dashboard.
3. Complete one Mobile Money test and one Card test, including callback, webhook, receipt, retry, and refund acceptance.
4. Configure the Production live secret and webhook, while keeping `ONLINE_PAYMENT_REQUIRED=false` so Cash remains available.
5. Complete one controlled, low-value live Production transaction and full refund.
6. Only after acceptance, set `ONLINE_PAYMENT_REQUIRED=true` if online-payment-only checkout is the desired product policy.
