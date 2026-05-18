# Shared-Service Database Schemas

Shared services use separate Postgres schemas for provider and business state. These schemas can live in the same Supabase Postgres project/database as API Center to save cost, but they are owned by the shared-service runtime, not by API Center control-plane code.

## Ownership Boundary

| Store | Responsibility |
| --- | --- |
| API Center schemas | Registry, routing, provisioning, audit, and operational control-plane state |
| Shared-service schemas | Provider/domain records for payment, OTP, email, SMS, geo, and Google OAuth |
| Redis | Hot TTL state, idempotency locks, OTP/SMS temporary state, and request caches |
| Confluent/S3 | Raw event export and analytics lake |
| Secret Manager | Provider secrets, private keys, webhook secrets, and OAuth client secrets |

Do not store provider secrets, plaintext OTP codes, plaintext refresh tokens, or raw high-cardinality payload logs in Postgres. Store sanitized metadata, hashes, provider ids, statuses, and references.

## Schemas

The shared-service migration creates:

```text
shared_payment
shared_otp
shared_email
shared_sms
shared_geo
shared_gauth
```

Supabase tracks migration history per project, not per repo. Because API Center
and shared services currently share one Supabase project/database, this repo
mirrors the full `supabase/migrations` ledger, including API Center
control-plane migrations. Shared-service code should still only own and query
the `shared_*` schemas.

## Tables

### `shared_payment`

| Table | Purpose |
| --- | --- |
| `checkout_sessions` | PayMongo checkout session metadata, status, tribe ownership, amount, redirects, and sanitized provider metadata |
| `payments` | Payment status snapshots and provider payment ids |
| `refunds` | Refund records tied to provider payment ids |
| `payment_webhook_events` | Webhook idempotency and processing status by provider event id |

Hybrid payment result pages use these tables as the backend source of truth.
Tribes own the success/cancelled/failed UI, but the PayMongo shared service owns
the state transitions:

```text
checkout created -> shared_payment.checkout_sessions.status = created
PayMongo paid webhook -> status = paid
PayMongo failed webhook -> status = failed
tribe cancel page marker -> status = cancelled
refund webhook/API call -> status = refunded or partially_refunded
```

The cancellation marker is exposed through:

```text
POST /api/v1/shared/payment/checkout/sessions/:checkoutId/cancelled
```

and normalized status is exposed through:

```text
GET /api/v1/shared/payment/checkout/sessions/:checkoutId/status
GET /api/v1/shared/payment/checkout/sessions/by-reference/:referenceId/status
```
| `receipts` | Receipt headers issued by the platform |
| `receipt_line_items` | Receipt and checkout line items |

### `shared_otp`

| Table | Purpose |
| --- | --- |
| `otp_challenges` | OTP challenge references, target hash, optional OTP hash, expiry, and verification status |
| `otp_attempts` | Verification attempts without storing plaintext codes |
| `otp_delivery_events` | Email/SMS delivery records for OTP dispatch |

### `shared_email`

| Table | Purpose |
| --- | --- |
| `email_messages` | Send metadata, recipient hash, provider id, status, and template reference |
| `email_templates` | Platform or tribe-owned template metadata |
| `email_delivery_events` | Provider delivery events and sanitized metadata |

### `shared_sms`

| Table | Purpose |
| --- | --- |
| `sms_messages` | SMS metadata, recipient hash, optional message hash, status, and provider id |
| `sms_delivery_events` | Provider delivery events and sanitized metadata |

### `shared_geo`

| Table | Purpose |
| --- | --- |
| `geocode_requests` | Geocode/reverse-geocode request hash, provider status, and normalized result reference |
| `normalized_locations` | Normalized address/place records with optional coordinates |
| `geofence_checks` | Geofence result metadata by request hash and tribe |

### `shared_gauth`

| Table | Purpose |
| --- | --- |
| `oauth_sessions` | OAuth state hash, requested scopes, redirect URI, expiry, and completion status |
| `oauth_accounts` | Linked Google account references by tribe without storing plaintext tokens |
| `oauth_token_refs` | Token vault references and expiry/status metadata |

## Environment

Use a dedicated shared-service DB URL so shared-service runtime permissions can be separated from API Center control-plane permissions:

```json
{
  "SHARED_SERVICES_DATABASE_ENABLED": "false",
  "SHARED_SERVICES_DATABASE_PROVIDER": "supabase",
  "SHARED_SERVICES_DATABASE_URL": "postgresql://shared_services_app:<password>@<supabase-pooler-host>:6543/postgres?pgbouncer=true"
}
```

Keep `SHARED_SERVICES_DATABASE_ENABLED=false` until the Supabase migrations are applied and each shared service has a runtime persistence implementation.

## Migration Commands

From `api-shared-services`:

```powershell
npx supabase init
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration new init_shared_service_schemas
npx supabase db reset
npx supabase db push --dry-run
npx supabase db push
```

Migration rule:

```text
Use Supabase SQL migrations under api-shared-services/supabase/migrations.
Keep Prisma schema files only if the runtime still needs generated clients.
Do not use prisma migrate deploy as the shared-service deployment path.
```

## Current Status

The schema mirror and initial Supabase SQL migration exist, and the migration
has been applied to Supabase project `qnebjcboppqdsgmgizvs`. The shared services
still use their current runtime stores. This is intentional. Enable runtime
persistence per service only after DB writes, Redis fallback behavior, and
secret redaction are tested.
