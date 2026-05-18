# SDK Guide: Shared Services Through APICenter

This guide is for tribe teams that consume APICenter and platform-owned shared
services through `@implementsprint/sdk`.

## Mental Model

Tribe applications do not call shared-service runtimes directly.

```text
tribe application
  -> @implementsprint/sdk
  -> APICenter gateway
  -> auth, registry, consumes, scope, rate-limit, and proxy checks
  -> shared-service runtime
  -> provider API or platform-owned implementation
```

APICenter is the synchronous gateway and policy layer. Confluent Cloud is only
the asynchronous event backbone for governed Kafka publishing; it is not in the
live request path for tribe-to-tribe or tribe-to-shared-service HTTP calls.

## What Each Part Owns

| Part | Owns |
| --- | --- |
| `@implementsprint/sdk` | Token lifecycle, gateway route construction, typed wrappers, retries, SDK errors |
| APICenter | Auth, registry, service discovery, policy checks, routing, proxying, audit, Kafka governance |
| Shared-service runtime | Provider-specific implementation behind APICenter, for example payment, email, SMS, Google auth, OTP |
| Tribe app | Business flow, SDK configuration, caller identity, request payloads |

The SDK is a gateway client. It is not a payment, email, SMS, OAuth, OTP, or
Kafka provider client.

## Install

Install from GitHub Packages, not the public npm registry.

```ini
@implementsprint:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm install @implementsprint/sdk
```

For the complete tribe setup checklist, including GitHub token permissions and
CI examples, see `docs/tribe-sdk-consumption.md`.

The current SDK package is restricted on GitHub Packages. If APICenter later
chooses public npm distribution, tribes can keep the same import path but no
longer need the GitHub Packages `.npmrc` token setup.

## Required Tribe Configuration

Each consuming service needs:

```text
APICENTER_URL=https://api-center.example.com
APICENTER_TRIBE_ID=<registered-service-id>
APICENTER_TRIBE_SECRET=<secret-issued-by-api-center>
```

APICenter must also be configured before the SDK call can succeed:

1. The calling tribe is registered in APICenter.
2. APICenter can resolve the caller's per-tribe Secret Manager secret named
   `api-center-tribe-secret-<service-id>`.
3. The target shared service is registered with `serviceType: "shared"`.
4. The calling tribe manifest includes the shared service in `consumes`.
5. The issued token includes the required scopes for the target service.

`TRIBE_SECRET_<SERVICE_ID_UPPER_SNAKE>` is still supported only for local/dev or
temporary rollback. New production tribe onboarding should not edit the shared
`api-center-prod` payload.

If a tribe is not allowed to consume a target service, the SDK request still goes
to APICenter, but APICenter rejects it before the shared-service runtime sees
the request.

## Create a Client

```ts
import { TribeClient } from '@implementsprint/sdk';

export const apiCenter = new TribeClient({
  gatewayUrl: process.env.APICENTER_URL!,
  tribeId: process.env.APICENTER_TRIBE_ID!,
  secret: process.env.APICENTER_TRIBE_SECRET!,
});
```

`TribeClient` authenticates lazily before the first request. You can also call
`authenticate()` explicitly during service startup if you want startup-time
failure instead of first-request failure.

```ts
await apiCenter.authenticate();
```

## Tribe-to-Tribe Calls

Use `callService` when calling another registered tribe service through API
Center.

```ts
const profile = await apiCenter.callService('profile-service', '/users/123', {
  method: 'GET',
});
```

The gateway route is:

```text
GET /api/v1/tribes/profile-service/users/123
```

APICenter resolves `profile-service` from the registry, checks the caller, and
proxies to the target service.

## Shared-Service Calls

Prefer typed wrappers when they exist.

### Payment

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

const status = await apiCenter.paymentGetCheckoutSession(checkout.checkoutId);
const normalizedStatus = await apiCenter.paymentGetCheckoutStatus(checkout.checkoutId);

await apiCenter.paymentMarkCheckoutCancelled(checkout.checkoutId, {
  reason: 'user_returned_from_cancel_url',
});

await apiCenter.paymentCreateRefund('pay_123', {
  amount: { value: 5000, currency: 'PHP' },
  reason: 'customer_request',
});
```

`paymentMethods` is optional. If omitted, the PayMongo shared service uses the
platform default configured in `PAYMONGO_DEFAULT_PAYMENT_METHODS`. Supported
request values are `qrph`, `gcash`, `grabpay` / `grab_pay`, `maya` / `paymaya`,
`card` / `visa` / `mastercard`, and `direct_online_banking`. Direct online
banking expands to the PayMongo DOB and Brankas checkout values that are enabled
by platform policy.

APICenter uses a hybrid payment-result model. The shared payment service owns
checkout state, PayMongo webhook verification, cancellation markers, refunds,
and S3 export events. The tribe owns the customer-facing success, cancelled,
and failed pages.

Recommended tribe flow:

1. Create checkout with tribe-owned `successUrl` and `cancelUrl`.
2. On the success page, call `paymentGetCheckoutStatus(checkoutId)` before
   fulfilling the order.
3. On the cancelled page, call `paymentMarkCheckoutCancelled(checkoutId)` and
   then `paymentGetCheckoutStatus(checkoutId)` to render the final state.
4. Render tribe-specific retry, order review, and support links in the frontend.

The cancelled page can show copy such as "No charges have been made to your
account" because the cancellation marker is only allowed for unpaid checkout
sessions.

### Email

```ts
const sent = await apiCenter.emailSend({
  to: 'customer@example.com',
  subject: 'Your receipt',
  body: 'Thanks for your payment.',
});

const status = await apiCenter.emailGetStatus(sent.messageId);
```

### SMS

```ts
const sent = await apiCenter.smsSend({
  to: '+639171234567',
  message: 'Your verification code is 123456',
});

const status = await apiCenter.smsGetStatus(sent.messageId);
```

### Google Auth

```ts
const authorization = await apiCenter.gauthGetAuthorizationUrl({
  redirectUri: 'https://app.example.com/auth/google/callback',
  scopes: ['openid', 'email', 'profile'],
  accessType: 'offline',
});

const tokens = await apiCenter.gauthExchangeCode({
  code: '<authorization_code>',
  redirectUri: 'https://app.example.com/auth/google/callback',
});

await apiCenter.gauthRefreshToken({
  refreshToken: tokens.refreshToken!,
});

await apiCenter.gauthLogout({
  refreshToken: tokens.refreshToken,
});
```

### OTP

```ts
const otp = await apiCenter.otpGenerate({
  recipient: '+639171234567',
  channel: 'sms',
  purpose: 'login',
});

const verification = await apiCenter.otpVerify({
  otpId: otp.otpId,
  code: '123456',
});

const status = await apiCenter.otpStatus(otp.otpId);
```

## Generic Shared-Service Calls

Use `callSharedService` only when a typed wrapper does not exist yet.

```ts
const response = await apiCenter.callSharedService('email', '/send', {
  method: 'POST',
  data: {
    to: 'customer@example.com',
    subject: 'Hello',
    body: 'Message body',
  },
});
```

The SDK sends this to APICenter:

```text
POST /api/v1/shared/email/send
```

APICenter proxies it to the registered email runtime path:

```text
POST /send
```

## Geo Shared Services

Geo capabilities are platform-owned shared services. Tribe apps call them
through APICenter and never call provider APIs directly.

```ts
const address = await apiCenter.geoGeocodeAddress({
  address: 'Manila, Philippines',
});

const location = await apiCenter.geoReverseGeocode({
  latitude: 14.5995,
  longitude: 120.9842,
});

const allowed = await apiCenter.geoFenceCheck({
  latitude: 14.5995,
  longitude: 120.9842,
  fenceId: 'metro-manila',
});
```

For lower-level shared-service calls without typed helpers:

```ts
await apiCenter.callSharedService('geo', '/reverse-geocode', {
  method: 'POST',
  data: { latitude: 14.5995, longitude: 120.9842 },
});
```

## Kafka and Confluent Cloud

Direct Kafka REST helpers are removed. Tribes publish events through APICenter
so APICenter can enforce topic policy and use platform-owned Confluent Cloud
credentials.

```ts
const governance = await apiCenter.kafkaGetGovernanceCatalog();
const topic = TribeClient.buildTenantTopic('orders-service', 'events');

await apiCenter.kafkaPublish({
  topic,
  key: 'order-123',
  eventType: 'order.created',
  payload: { orderId: 'order-123' },
});
```

Runtime path:

```text
tribe app
  -> @implementsprint/sdk
  -> POST /api/v1/kafka/publish
  -> APICenter Kafka governance
  -> Confluent Cloud topic
  -> Confluent S3 Sink Connector, if configured
  -> AWS S3 raw data lake
```

## Discovery

Use discovery helpers to confirm what APICenter sees.

```ts
const tribeServices = await apiCenter.listTribeServices();
const sharedServices = await apiCenter.listSharedServices();
const allServices = await apiCenter.listAllServices();
const payment = await apiCenter.getService('payment');
const scopes = await apiCenter.getServiceScopes();
```

`getServiceScopes()` calls `/api/v1/registry/scopes`. If the caller cannot read
that endpoint, the SDK falls back to deriving dynamic service scopes from service
discovery results available to the caller.

## Error Handling

SDK errors are mapped into typed classes from `@implementsprint/sdk`.

```ts
import {
  ApiCenterAuthenticationError,
  ApiCenterForbiddenError,
  ApiCenterNotFoundError,
  ApiCenterRateLimitError,
  ApiCenterUpstreamError,
} from '@implementsprint/sdk';

try {
  await apiCenter.paymentGetCheckoutSession('checkout_123');
} catch (error) {
  if (error instanceof ApiCenterForbiddenError) {
    // Missing consumes entry or required scope.
  }

  if (error instanceof ApiCenterUpstreamError) {
    // APICenter reached the target runtime, but the runtime/provider failed.
  }

  throw error;
}
```

## Common Failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401` from token endpoint | Wrong tribe ID or secret | Check `APICENTER_TRIBE_ID`, `APICENTER_TRIBE_SECRET`, and APICenter secret store |
| `403` on shared service | Missing `consumes` or scope | Update tribe manifest and APICenter registry policy |
| `404` target service | Service is not registered or unhealthy | Check `listSharedServices()` and runtime registration logs |
| Kafka publish rejected | Topic violates governance | Use `buildTenantTopic()` and check `kafkaGetGovernanceCatalog()` |
| Runtime receives no request | APICenter rejected before proxying | Inspect APICenter auth, scope, registry, and audit logs |

## Local Validation

Run these before publishing SDK changes:

```bash
npm run check:contracts
npm run ci
```

`check:contracts` verifies that shared-service manifests and SDK wrapper names
stay aligned with `contracts/shared-service-contract.json`.

## Adding a New Shared Service

1. Add `shared-services/manifests/<service>-manifest.json`.
2. Add or update the runtime under `shared-services/<service>/`.
3. Add typed request and response types in `src/types.ts`.
4. Add typed wrappers in `src/TribeClient.ts`.
5. Add the manifest and wrapper names to `contracts/shared-service-contract.json`.
6. Run `npm run check:contracts`.
7. Run `npm run ci`.
8. Register the shared-service runtime with APICenter in the target environment.
9. Add the service ID to each allowed tribe manifest `consumes` list.
