# PayMongo Shared Payment Gateway

This shared service is a contract-first wrapper for PayMongo payment flows.

Purpose:

- Give tribes a stable AP Center-facing payment contract.
- Decouple tribe applications from provider-specific APIs.
- Keep mock mode available for local development while supporting live PayMongo calls in production.

## Current Status

- Provider mode: `mock` for local development, `live` for production.
- Live checkout and refund calls use PayMongo's public API.
- Checkout creation and refunds require an idempotency key.
- Webhooks are verified inside this service before tribes receive normalized events.

## Routes

- GET /health
- POST /checkout/sessions
- GET /checkout/sessions/:checkoutId
- POST /payments/:paymentId/refunds
- POST /webhooks

## Run Locally

```bash
npm install
npm run dev
```

Default base URL:

- http://localhost:4010

Local mock mode:

```bash
PAYMENT_PROVIDER_MODE=mock npm run dev
```

Provider mode requires:

```bash
PAYMENT_PROVIDER_MODE=test # or live
PAYMONGO_TEST_SECRET_KEY=sk_test_key
PAYMONGO_LIVE_SECRET_KEY=sk_live_key
PAYMONGO_TEST_WEBHOOK_SECRET=test_webhook_secret_from_paymongo
PAYMONGO_LIVE_WEBHOOK_SECRET=live_webhook_secret_from_paymongo
```

The legacy single-key variables `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are intentionally not supported. Keep test and live credentials separate, then switch environments only by changing `PAYMENT_PROVIDER_MODE`.

Optional settings:

```bash
PAYMONGO_BASE_URL=https://api.paymongo.com/v1
PAYMONGO_ALLOWED_PAYMENT_METHODS=qrph,gcash,grab_pay,paymaya,card,dob,dob_ubp,brankas_bdo,brankas_landbank,brankas_metrobank
PAYMONGO_DEFAULT_PAYMENT_METHODS=qrph,gcash,grab_pay,paymaya,card,dob,dob_ubp,brankas_bdo,brankas_landbank,brankas_metrobank
```

Checkout and refund requests must include either:

```text
Idempotency-Key: unique-operation-key
```

or an `idempotencyKey` field in the JSON body.

## Configurable Payment Methods

Checkout creation supports every PayMongo method currently enabled in the
platform policy:

| Payment option | Request value | PayMongo value sent |
| --- | --- | --- |
| QRPh | `qrph` | `qrph` |
| GCash | `gcash` | `gcash` |
| GrabPay | `grabpay` or `grab_pay` | `grab_pay` |
| Maya | `maya` or `paymaya` | `paymaya` |
| Visa / Mastercard | `visa`, `mastercard`, or `card` | `card` |
| Direct Online Banking | `direct_online_banking` or `online_banking` | `dob`, `dob_ubp`, `brankas_bdo`, `brankas_landbank`, `brankas_metrobank` |
| BPI / UnionBank direct banking | `dob` | `dob` |
| Brankas banks | `brankas` | `brankas_bdo`, `brankas_landbank`, `brankas_metrobank` |

If the request omits `paymentMethods`, the service uses
`PAYMONGO_DEFAULT_PAYMENT_METHODS`. If that variable is unset, it uses every
method in `PAYMONGO_ALLOWED_PAYMENT_METHODS`. If both variables are unset, the
service allows all values listed in the table above.

Example checkout request:

```json
{
  "referenceId": "order-123",
  "idempotencyKey": "checkout-order-123",
  "successUrl": "https://app.example.com/payment/success",
  "cancelUrl": "https://app.example.com/payment/cancel",
  "paymentMethods": ["card", "gcash", "maya", "grabpay", "qrph", "direct_online_banking"],
  "lineItems": [
    {
      "name": "Starter Plan",
      "quantity": 1,
      "amount": { "value": 99900, "currency": "PHP" }
    }
  ]
}
```

The response includes the normalized methods used for the checkout session:

```json
{
  "checkoutId": "cs_...",
  "provider": "paymongo",
  "status": "pending",
  "paymentMethodsAllowed": ["card", "gcash", "paymaya", "grab_pay", "qrph"]
}
```

PayMongo account eligibility still applies. The Dashboard must have the methods
approved/enabled, especially cards, GCash, e-wallets, and Direct Online Banking.
QRPh is usually available earlier, but QRPh test flows can still generate live
QRPh codes, so do not complete QRPh payments in test mode unless PayMongo
confirms the account is safe for that test.

SDK example:

```ts
await client.paymentCreateCheckoutSession({
  referenceId: 'order-123',
  idempotencyKey: 'checkout-order-123',
  successUrl: 'https://app.example.com/payment/success',
  cancelUrl: 'https://app.example.com/payment/cancel',
  paymentMethods: ['card', 'gcash', 'maya', 'grabpay', 'qrph'],
  lineItems: [
    {
      name: 'Starter Plan',
      quantity: 1,
      amount: { value: 99900, currency: 'PHP' },
    },
  ],
});

await client.paymentCreateRefund('pay_123', {
  idempotencyKey: 'refund-pay-123',
  amount: { value: 5000, currency: 'PHP' },
  reason: 'customer_request',
});
```

## Registration

Use the shared manifest in:

- ../../manifests/payment-manifest.json

Register through AP Center registry and route through:

- /api/v1/shared/payment/*

## PayMongo API Mapping

- `POST /checkout/sessions` maps to PayMongo `POST /v1/checkout_sessions`.
- `GET /checkout/sessions/:checkoutId` maps to PayMongo `GET /v1/checkout_sessions/:id`.
- `GET /checkout/sessions/:checkoutId/status` returns API Center's normalized payment state.
- `GET /checkout/sessions/by-reference/:referenceId/status` returns normalized state scoped to the calling tribe.
- `POST /checkout/sessions/:checkoutId/cancelled` marks an unpaid checkout as cancelled when the customer returns through the tribe `cancelUrl`.
- `POST /payments/:paymentId/refunds` maps to PayMongo `POST /v1/refunds`.
- `POST /webhooks` validates the `Paymongo-Signature` header, records the provider event idempotently when persistence is enabled, and updates normalized payment state.

When `SHARED_SERVICES_DATABASE_ENABLED=false`, the status and cancellation routes remain backward-compatible but do not persist state. Enable persistence only after `SHARED_SERVICES_DATABASE_URL` points to the correct test or live Supabase database.

Tribes should call this service through AP Center:

```text
/api/v1/shared/payment/*
```

Tribes should not call PayMongo directly.
