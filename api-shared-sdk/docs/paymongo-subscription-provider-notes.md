# PayMongo Subscription Provider Notes

Verified on 2026-05-17 from current PayMongo product and developer documentation.

## Provider Capability

PayMongo currently documents first-class subscription support:

- Product page: `https://www.paymongo.com/products/accept-payments/subscriptions`
- Subscription resource: `https://developers.paymongo.com/reference/subscription-resource`
- Subscription statuses: `https://developers.paymongo.com/docs/statuses-subscription`
- Subscription test cases: `https://developers.paymongo.com/docs/subscriptions-test-cases`

## Decision

Use **Model A: PayMongo has first-class subscriptions**.

API Center should expose a Stripe-like wrapper while the PayMongo shared service maps the canonical subscription resource to PayMongo subscription APIs.

## Initial API Center Wrapper Boundary

Keep provider credentials in `api-shared-services-prod`:

- `PAYMONGO_TEST_SECRET_KEY`
- `PAYMONGO_LIVE_SECRET_KEY`
- `PAYMONGO_TEST_WEBHOOK_SECRET`
- `PAYMONGO_LIVE_WEBHOOK_SECRET`

Do not store plan, product, price, or subscription IDs in Secret Manager. Those are operational records and should live in the `shared_payment` schema once subscription persistence is implemented.

## Rollout Guard

Subscription creation must stay disabled until the shared service has:

- canonical SDK types;
- subscription routes;
- persistence for customer, product, price, subscription, invoice, and event state;
- PayMongo webhook mappings;
- test-mode end-to-end verification.

Use `PAYMENT_SUBSCRIPTIONS_ENABLED=false` as the default runtime posture.
