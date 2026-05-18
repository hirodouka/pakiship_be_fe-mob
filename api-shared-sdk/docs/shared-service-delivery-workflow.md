# Shared Service Delivery Workflow

This runbook defines collaboration between APICenter team, shared SDK team,
and shared service runtime teams.

## Runtime Model

Shared services are reached through APICenter, not directly by tribes.

```text
tribe application
  -> @implementsprint/sdk
  -> /api/v1/shared/:serviceId/*
  -> APICenter auth, registry, consumes, and scope checks
  -> shared-service runtime
  -> provider API
```

The shared-service runtime owns provider-specific behavior, but APICenter owns access control. Runtime services should trust APICenter forwarding headers for caller identity and request tracing:

- `X-Tribe-Id`
- `X-Correlation-ID`
- `X-Forwarded-By: apicenter-gateway`

## Team Responsibilities

- APICenter team:
  - Publish and govern gateway contracts.
  - Enforce auth, scopes, and routing policies.
- Shared SDK team:
  - Implement tribe-facing typed wrappers from APICenter contracts.
  - Release SDK versions with migration notes.
- Shared runtime team:
  - Implement provider-specific logic (for example PayMongo).
  - Maintain webhook handling and provider-side idempotency controls.

## Artifact Ownership

This repository owns:

- `src/` SDK source for `@implementsprint/sdk`.
- `shared-services/manifests/` registration manifests.
- `shared-services/*` shared-service runtime scaffolds.
- `contracts/shared-service-contract.json` compatibility snapshot.

The `api-center` repository owns:

- Gateway controllers and proxy behavior.
- Registry persistence and lifecycle state.
- Auth-provider internals and token validation.
- Scope enforcement, rate limiting, circuit breakers, metrics, and audit events.

Do not duplicate shared-service runtime code into `api-center`. Do not put APICenter auth-provider internals into this SDK.

## Contract-first Path

1. Propose contract shape in APICenter (routes, scopes, errors).
2. Build SDK wrappers in `api-shared-services` against that contract.
3. Ship draft runtime with mock behavior that matches contract.
4. Replace mock internals with real provider integration when API access is ready.
5. Run `npm run check:contracts` before every SDK release to enforce wrapper/manifest contract parity.

## Adding or Updating a Shared Service

1. Add or update the manifest in `shared-services/manifests/`.
2. Make sure the manifest has `serviceType: "shared"` and a deployable `baseUrl`.
3. Add runtime routes under the matching `shared-services/<service>/` folder.
4. Add or update typed SDK methods in `src/TribeClient.ts`.
5. Add or update request/response types in `src/types.ts`.
6. Add the wrapper names and manifest path to `contracts/shared-service-contract.json`.
7. Run `npm run check:contracts`.
8. Run `npm run ci` before publishing a new SDK version.

The runtime can start in mock mode while provider credentials or final provider API details are unavailable, but mock responses must match the SDK-facing contract.

## Tribe Adoption Checklist

Before handing a shared service to a tribe team, verify:

- The tribe installs `@implementsprint/sdk` from the private registry.
- The tribe has `APICENTER_URL`, `APICENTER_TRIBE_ID`, and `APICENTER_TRIBE_SECRET`.
- The tribe is registered in APICenter.
- APICenter can resolve `api-center-tribe-secret-<service-id>` for that tribe.
  The legacy `TRIBE_SECRET_*` env path is only for local/dev or temporary rollback.
- The tribe manifest includes the shared service ID in `consumes`.
- The shared service is registered and visible through `client.listSharedServices()`.
- The typed SDK wrapper returns the expected contract shape through APICenter.

## Versioning Rules

- Additive changes: minor SDK bump.
- Breaking field or route changes: major SDK bump.
- During migrations, APICenter keeps compatibility path where practical.

## Payment Draft Contract Baseline

- POST `/api/v1/shared/payment/checkout/sessions`
- GET `/api/v1/shared/payment/checkout/sessions/:checkoutId`
- POST `/api/v1/shared/payment/payments/:paymentId/refunds`

The initial runtime draft is under:

- `shared-services/paymongo/` (Official PayMongo shared gateway)

### PayMongo Payment Method Policy

The PayMongo runtime owns provider-specific payment method mapping. Tribes call
the stable SDK/APICenter contract and may pass `paymentMethods` when creating a
checkout session. The runtime normalizes friendly aliases, checks them against
platform policy, and sends PayMongo's `payment_method_types` values.

Supported request values:

| Tribe request value | Normalized PayMongo value |
| --- | --- |
| `qrph` | `qrph` |
| `gcash` | `gcash` |
| `grabpay`, `grab_pay` | `grab_pay` |
| `maya`, `paymaya` | `paymaya` |
| `card`, `visa`, `mastercard` | `card` |
| `dob` | `dob` |
| `brankas` | `brankas_bdo`, `brankas_landbank`, `brankas_metrobank` |
| `direct_online_banking`, `online_banking` | `dob`, `dob_ubp`, `brankas_bdo`, `brankas_landbank`, `brankas_metrobank` |

Runtime configuration:

```text
PAYMONGO_ALLOWED_PAYMENT_METHODS=qrph,gcash,grab_pay,paymaya,card,dob,dob_ubp,brankas_bdo,brankas_landbank,brankas_metrobank
PAYMONGO_DEFAULT_PAYMENT_METHODS=qrph,gcash,grab_pay,paymaya,card,dob,dob_ubp,brankas_bdo,brankas_landbank,brankas_metrobank
```

`PAYMONGO_ALLOWED_PAYMENT_METHODS` is the platform guardrail. If a tribe requests
a method outside that list, the runtime rejects the checkout request before
calling PayMongo. `PAYMONGO_DEFAULT_PAYMENT_METHODS` is used when a tribe omits
`paymentMethods`.

PayMongo account eligibility still applies. Enabling a method in the shared
service only allows the request to reach PayMongo; the method must also be
approved/enabled in the PayMongo Dashboard.
