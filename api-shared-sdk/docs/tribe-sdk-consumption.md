# Tribe SDK Consumption Guide

This guide is for tribe teams that need to expose their own service through API
Center, call platform shared services, call other tribe services, or publish
governed events through the gateway.

For a step-by-step consumer-side operating checklist, use
`docs/consumer-runbook.md`.

Publishing `@implementsprint/sdk` is a platform-maintainer concern. Tribe teams
only need to install the SDK, register their service with APICenter, declare
what they expose and consume, and call the gateway.

## What You Install

Install the SDK from GitHub Packages:

```text
@implementsprint/sdk
```

Payment subscription wrappers require SDK version `1.1.0` or newer.
Checkout-only consumers can remain on older versions, but new tribe
integrations should use the latest SDK package.

The SDK is not the gateway. It is a client wrapper that calls APICenter.
Installing it does not grant access by itself.

## Is The SDK Public?

Right now, the SDK package is **not public npm**. It is published to GitHub
Packages:

```text
https://npm.pkg.github.com
```

The package is configured with restricted access, so tribe teams need GitHub
Packages authentication to install it.

Even if the package visibility is changed to public in GitHub Packages, npm
install flows still normally need GitHub Packages auth. If the goal is
token-free installs for any tribe repository, the SDK should be published to the
public npm registry instead.

The SDK package being visible does not give anyone access to APICenter. Package
auth is only install-time auth. Live API access still requires a registered
tribe ID, a valid tribe secret, allowed scopes, and `consumes` policy in API
Center.

## What You Need From APICenter

Before your service can use the SDK, the APICenter/platform team must give you:

| Value | Example | Purpose |
| --- | --- | --- |
| `APICENTER_URL` | `https://api-center.itsandbox.site` | Public APICenter gateway URL |
| `APICENTER_TRIBE_ID` | `campusone` | Your registered service or tribe ID |
| `APICENTER_TRIBE_SECRET` | secret value issued by platform | Used by APICenter to issue tokens |
| Allowed `consumes` list | `payment`, `email`, `geo` | Shared/tribe services your tribe can call |
| Required scopes | `payment:charge`, `email:send` | Authorization scopes issued in your token |

APICenter stores only the hashed tribe secret in a per-tribe Secret Manager
secret:

```text
api-center-tribe-secret-<service-id>
```

For `campusone`, that is:

```text
api-center-tribe-secret-campusone
```

The old `TRIBE_SECRET_<SERVICE_ID_UPPER_SNAKE>` env var is only a local/dev or
temporary rollback fallback. New production tribe onboarding should not require
editing `api-center-prod`.

## How APICenter Sees Your Service

APICenter treats each tribe backend as a registered service. The registration
model has two sides:

| Field | Meaning |
| --- | --- |
| `serviceId` | Stable ID used in SDK calls and auth, for example `orders-service` |
| `baseUrl` | Internal or public URL APICenter can reach when proxying to your service |
| `exposes` | Routes your service allows other approved services to call |
| `consumes` | Shared services or tribe services your service is allowed to call |
| `requiredScopes` | Scopes callers need when they call your exposed routes |
| `serviceType` | Usually `tribe` for tribe-owned services; platform shared services use `shared` |

Example tribe service registration:

```json
{
  "serviceId": "orders-service",
  "name": "Orders Service",
  "serviceType": "tribe",
  "baseUrl": "https://orders.internal.example.com",
  "requiredScopes": ["orders:read", "orders:write"],
  "exposes": ["/orders", "/orders/:id"],
  "consumes": ["payment", "email", "profile-service"]
}
```

In that example:

- Other approved services call orders through APICenter with
  `callService('orders-service', '/orders/123')`.
- `orders-service` can call platform payment and email shared services because
  they are listed in `consumes`.
- `orders-service` can call `profile-service` because that tribe service is
  also listed in `consumes`.
- APICenter rejects any target service or route not allowed by registration,
  scopes, lifecycle, and health policy.

## Gateway Routes

The SDK builds gateway URLs for you. Teams should understand the route families,
but should not hard-code provider URLs or shared-service runtime URLs.

| SDK call | APICenter route | Used for |
| --- | --- | --- |
| `callService('profile-service', '/users/123')` | `/api/v1/tribes/profile-service/users/123` | Tribe-to-tribe service calls |
| `callSharedService('email', '/send')` | `/api/v1/shared/email/send` | Generic shared-service calls |
| `emailSend(...)` | `/api/v1/shared/email/send` | Typed email helper |
| `paymentCreateCheckoutSession(...)` | `/api/v1/shared/payment/checkout/sessions` | Typed payment helper |
| `kafkaPublish(...)` | `/api/v1/kafka/publish` | Governed business-event publishing |

APICenter always sits in the middle:

```text
tribe service
  -> @implementsprint/sdk
  -> APICenter gateway
  -> auth, registry, consumes, scope, lifecycle, rate-limit checks
  -> target tribe service or platform shared-service runtime
```

## Exposing Your Service

To expose a tribe-owned API through APICenter:

1. Pick a stable `serviceId`, for example `orders-service`.
2. Implement your service routes and a health endpoint.
3. Give platform your reachable `baseUrl`.
4. List the routes other teams may call in `exposes`.
5. List the scopes required to call those routes in `requiredScopes`.
6. List the services your own code needs to call in `consumes`.
7. Platform registers or updates the service in APICenter.
8. Ask a consumer team to test through the SDK, not by calling your service URL
   directly.

Example consumer call to your exposed route:

```ts
const order = await apiCenter.callService('orders-service', '/orders/123', {
  method: 'GET',
});
```

The caller must have `orders-service` in its `consumes` list and must receive the
required scope for the route. If either is missing, APICenter returns `403`
before your service receives the request.

## Configure GitHub Packages

Create `.npmrc` in your tribe repository:

```ini
@implementsprint:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Set `GITHUB_TOKEN` to a GitHub token with `read:packages` permission and access
to the `ImplementSprint` package.

For local development on Windows PowerShell:

```powershell
$env:GITHUB_TOKEN = "ghp_..."
npm install @implementsprint/sdk
```

For CI in a tribe repository, store the token as a repository or organization
secret and expose it only during install:

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: '24'
    registry-url: https://npm.pkg.github.com
    scope: '@implementsprint'

- run: npm ci
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

If the consuming tribe repository is not allowed to read the package with its
default `GITHUB_TOKEN`, use a classic PAT secret with `read:packages`.

## Install

```bash
npm install @implementsprint/sdk
```

Then commit the resulting `package.json` and lockfile changes.

## Runtime Environment

Your service needs these runtime variables:

```env
APICENTER_URL=https://api-center.itsandbox.site
APICENTER_TRIBE_ID=campusone
APICENTER_TRIBE_SECRET=<secret-issued-by-platform>
```

Do not store provider credentials such as PayMongo, Resend, Google Maps, or
Confluent credentials in tribe apps for shared-service calls. Those belong to
APICenter or the shared-service runtimes.

## Basic Usage

```ts
import { TribeClient } from '@implementsprint/sdk';

export const apiCenter = new TribeClient({
  gatewayUrl: process.env.APICENTER_URL!,
  tribeId: process.env.APICENTER_TRIBE_ID!,
  secret: process.env.APICENTER_TRIBE_SECRET!,
});
```

The client authenticates lazily before the first request. You can also fail fast
during startup:

```ts
await apiCenter.authenticate();
```

## Calling Shared Services

Prefer typed wrappers when available:

| Shared service | Preferred SDK helpers | Generic gateway path |
| --- | --- | --- |
| Payment | `paymentCreateCheckoutSession`, `paymentGetCheckoutStatus`, `paymentCreateRefund`, customer/product/price/subscription helpers | `/api/v1/shared/payment/*` |
| Email | `emailSend`, `emailGetStatus` | `/api/v1/shared/email/*` |
| SMS | `smsSend`, `smsGetStatus` | `/api/v1/shared/sms/*` |
| Google auth | `gauthGetAuthorizationUrl`, `gauthExchangeCode`, `gauthRefreshToken`, `gauthLogout` | `/api/v1/shared/gauth/*` |
| OTP | `otpGenerate`, `otpVerify`, `otpStatus` | `/api/v1/shared/otp/*` |
| Geo | `geoGeocodeAddress`, `geoReverseGeocode`, `geoFenceCheck` | `/api/v1/shared/geo/*` |

Use typed helpers first. Use `callSharedService` only when a wrapper does not
exist yet.

```ts
await apiCenter.emailSend({
  to: 'customer@example.com',
  subject: 'Welcome',
  body: 'Thanks for joining.',
});
```

```ts
const checkout = await apiCenter.paymentCreateCheckoutSession({
  referenceId: 'order-123',
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
```

Subscriptions use the same SDK and APICenter path. Tribe apps do not need
PayMongo keys or a provider-mode flag.

```ts
const customer = await apiCenter.paymentCreateCustomer({
  email: 'customer@example.com',
  name: 'Customer Name',
});

const product = await apiCenter.paymentCreateProduct({
  name: 'Starter Subscription',
});

const price = await apiCenter.paymentCreatePrice({
  productId: product.productId,
  amount: { value: 99900, currency: 'PHP' },
  recurring: { interval: 'month', intervalCount: 1 },
});

const subscription = await apiCenter.paymentCreateSubscription({
  customerId: customer.customerId,
  priceId: price.priceId,
  referenceId: 'subscription-123',
});

const status = await apiCenter.paymentGetSubscription(
  subscription.subscriptionId,
);

await apiCenter.paymentCancelSubscription(subscription.subscriptionId, {
  cancelAtPeriodEnd: false,
});
```

Platform config decides whether the provider runs in `test` or `live` mode.
Tribe apps should treat `provider` and `providerMode` in responses as
observability fields, not as credentials or direct-provider routing knobs.

`paymentMethods` is optional. If you omit it, APICenter routes the call to the
PayMongo shared service and that service applies the platform default. Use this
field only when your checkout needs to limit the available choices.

Supported payment method request values:

| Option | Value |
| --- | --- |
| QRPh | `qrph` |
| GCash | `gcash` |
| GrabPay | `grabpay` or `grab_pay` |
| Maya | `maya` or `paymaya` |
| Visa / Mastercard | `card`, `visa`, or `mastercard` |
| Direct Online Banking | `direct_online_banking`, `online_banking`, `dob`, or `brankas` |

The platform may still reject a method if it is not enabled for the environment
or PayMongo account. Do not call PayMongo directly to bypass that policy.

```ts
const location = await apiCenter.geoReverseGeocode({
  latitude: 14.5995,
  longitude: 120.9842,
});
```

The runtime path is:

```text
tribe service
  -> @implementsprint/sdk
  -> APICenter /api/v1/shared/:serviceId/*
  -> APICenter auth, registry, consumes, scope, and rate-limit checks
  -> shared-service runtime
  -> provider API
```

## Calling Another Tribe

Use `callService` for tribe-to-tribe calls:

```ts
const profile = await apiCenter.callService('profile-service', '/users/123', {
  method: 'GET',
});
```

APICenter checks whether your tribe is allowed to consume `profile-service`
before proxying the request.

## Publishing Events For S3

Use governed Kafka helpers for tribe business events:

```ts
const topic = TribeClient.buildTenantTopic('campusone', 'events');

await apiCenter.kafkaPublish({
  topic,
  key: 'order-123',
  eventType: 'order.created',
  payload: {
    orderId: 'order-123',
    amount: 99900,
    currency: 'PHP',
  },
});
```

The event path is:

```text
tribe service
  -> @implementsprint/sdk
  -> APICenter /api/v1/kafka/publish
  -> APICenter Kafka governance
  -> Confluent Cloud topic
  -> Confluent S3 Sink
  -> AWS S3 raw data lake
```

Only data published to governed Kafka topics can flow into S3. Normal HTTP API
calls do not automatically become tribe business datasets unless APICenter or
the tribe publishes an event for them.

Analytics consumers should be added downstream from S3 later. They are not
required for tribe SDK usage.

## Common Errors

| Error | Meaning | Fix |
| --- | --- | --- |
| `401` token request | Wrong tribe ID or secret | Check `APICENTER_TRIBE_ID` and `APICENTER_TRIBE_SECRET` |
| `403` shared-service call | Missing `consumes` entry or scope | Ask platform to update your tribe registration |
| `404` service call | Target service is not registered or not healthy | Check discovery or APICenter registry |
| npm `404` installing SDK | Missing GitHub Packages auth or access | Check `.npmrc` and token `read:packages` |
| npm `401` installing SDK | Token is missing/invalid | Refresh the GitHub token |

## Tribe Checklist

Before going live:

- `.npmrc` points `@implementsprint` to `https://npm.pkg.github.com`.
- CI can run `npm ci`.
- `@implementsprint/sdk` is in `package.json`.
- Runtime has `APICENTER_URL`, `APICENTER_TRIBE_ID`, and `APICENTER_TRIBE_SECRET`.
- Tribe is registered in APICenter.
- Tribe manifest lists every shared or tribe service it needs in `consumes`.
- At least one SDK smoke test passes against APICenter.

## Platform SDK Smoke

Platform operators can validate the payment subscription wrapper from the same
consumer path tribes use:

```powershell
$env:APICENTER_GATEWAY_URL = "https://api-center-test.itsandbox.site"
$env:APICENTER_TRIBE_ID = "smoke-tribe"
$env:APICENTER_TRIBE_SECRET = "<current smoke-tribe secret>"
npm run build
npm run smoke:payment-subscription:sdk
```

The script authenticates through APICenter, creates a customer, product, price,
and subscription, reads the subscription, cancels it, and reads it again. A
passing test returns `provider: "paymongo"` and the configured provider mode.
