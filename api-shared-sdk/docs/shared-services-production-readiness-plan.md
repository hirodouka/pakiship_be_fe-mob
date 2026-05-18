# Shared Services Production Readiness

This document tracks only the remaining production-readiness work for
platform-owned shared services. Earlier SDK contract, runtime test, OTP/SMS
Redis, PayMongo, and alert-documentation phases have been implemented and are
covered by the repo tests and service docs.

## Current Implemented State

- SDK wrapper contract checks are enforced by `npm run check:contracts`.
- Runtime route tests cover payment, email, SMS, Google auth, OTP, and geo.
- OTP and SMS support Redis-backed production storage.
- PayMongo uses split test/live secret keys and webhook secrets.
- PayMongo checkout supports configurable payment methods through
  `PAYMONGO_ALLOWED_PAYMENT_METHODS` and `PAYMONGO_DEFAULT_PAYMENT_METHODS`.
  Supported methods include QRPh, GCash, GrabPay, Maya, cards, and Direct Online
  Banking/DOB/Brankas values.
- Monitoring guidance exists in `docs/monitoring/shared-services-alerts.md`.
- Root package and runtime gateway images target Node 24 LTS.
- GKE manifests live in `gcp/gke/00-shared-services.yaml`.
- Runtime images tagged `c090386` were built and pushed to Artifact Registry.
- The six shared services are deployed in the `api-center` namespace as internal
  `ClusterIP` services with HPA min `1`, max `3`.
- `api-shared-services-prod` is synced from GCP Secret Manager into a Kubernetes
  secret of the same name.
- API Center registry lists all six shared services as active.
- API Center can reach each shared-service `/health` endpoint in-cluster.
- Shared-service Postgres schemas and an initial Prisma migration SQL source
  exist, but `SHARED_SERVICES_DATABASE_ENABLED` should stay `false` until the
  SQL has been converted to Supabase migrations and runtime persistence wiring
  is ready.

## Remaining Work

### 1. End-to-End SDK Smoke Calls

Run one authenticated SDK call through API Center for each shared service:

- geo lookup
- email send/status
- Google auth URL/token flow
- PayMongo checkout/webhook path
  - Include at least one smoke checkout with explicit `paymentMethods`.
  - Confirm live/test PayMongo Dashboard method eligibility before enabling new
    methods for production traffic.
- SMS send/status
- OTP generate/verify/status

### 2. Production Traffic Controls

- Keep each shared service at HPA min `1`, max `3` while traffic is low.
- Raise the HPA minimum to `2` for services that need no-downtime restarts.
- Keep shared services internal only; do not add public load balancers.
- After changing `api-shared-services-prod`, run `scripts/sync-gke-secret.ps1`
  and restart only the affected deployment.

### 3. Optional Database Cutover

- Create the shared-service Supabase runtime credentials separately from API
  Center's control-plane credentials.
- Convert the reviewed SQL into `supabase/migrations`, then run
  `npx supabase db push --dry-run` and `npx supabase db push`.
- Keep `SHARED_SERVICES_DATABASE_ENABLED=false` until each gateway has tests for
  DB writes, Redis fallback behavior, and secret redaction.
- Enable persistence one shared service at a time, starting with the lowest-risk
  service.

## Release Criteria

Shared services are ready for tribe production use when:

- `npm run ci` passes in this repo.
- API Center registry lists all six shared services.
- Each runtime has a production service URL in its manifest.
- OTP and SMS are Redis-backed in production.
- If shared-service DB persistence is enabled, migrations have been deployed and
  DB write/read smoke tests pass.
- At least one end-to-end SDK call succeeds through API Center per shared service.
- API Center readiness and Kafka producer metrics stay healthy after traffic.
