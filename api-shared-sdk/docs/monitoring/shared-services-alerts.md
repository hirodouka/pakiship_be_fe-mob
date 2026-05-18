# Shared Services Alerts

This document defines the first production alerts for API Center shared-service operations.

## Metrics Source

API Center exposes Prometheus-compatible metrics at:

```text
GET /api/v1/metrics
```

The shared-service runtimes should be scraped separately once deployed. Until those services expose their own metrics, use API Center readiness plus gateway/proxy request metrics as the first operator signal.

## Required Alerts

### Kafka Producer Disconnected

Signal:

```promql
kafka_producer_connected == 0
```

Severity: critical

Meaning: API Center cannot publish gateway, audit, registry, or shared-service events to Confluent Cloud.

Immediate checks:

- Confirm `KAFKA_BROKERS` points to Confluent Cloud.
- Confirm `KAFKA_SASL_MECHANISM=plain`.
- Confirm `KAFKA_SASL_USERNAME` and `KAFKA_SASL_PASSWORD` are Kafka cluster API credentials, not Confluent Cloud management API credentials.
- Restart API Center pods after Secret Manager changes.

### Kafka Publish Failures

Signal:

```promql
increase(kafka_publish_failures_total[5m]) > 0
```

Severity: warning for any failure, critical if sustained for 15 minutes.

Meaning: API Center is connected to Kafka but one or more publish attempts failed.

Immediate checks:

- Check API Center logs for topic authorization or serialization errors.
- Confirm the target Confluent topic exists.
- Confirm the Kafka cluster API key has produce permission for the target topic.

### API Center Readiness Failure

Signal:

```promql
up{job="api-center"} == 0
```

or, if probing the readiness endpoint:

```promql
probe_success{instance=~".*/api/v1/health/ready"} == 0
```

Severity: critical

Meaning: API Center is not healthy enough to serve tribe/shared-service traffic.

Immediate checks:

- Inspect `/api/v1/health/ready`.
- Check individual dependency states for Kafka, Redis, and registry.
- Inspect pod restart count and recent logs.

### Shared-Service 5xx Rate

Signal:

```promql
sum by (service) (rate(http_requests_total{route=~"/api/v1/shared/.*",status=~"5.."}[5m])) > 0
```

Severity: warning for any service, critical if sustained for 10 minutes.

Meaning: a shared-service route is failing behind API Center.

Immediate checks:

- Identify the `serviceId` from the route label or API Center logs.
- Check the shared-service pod logs.
- Verify service-specific secrets:
  - PayMongo: `PAYMONGO_TEST_SECRET_KEY` / `PAYMONGO_LIVE_SECRET_KEY`, `PAYMONGO_TEST_WEBHOOK_SECRET` / `PAYMONGO_LIVE_WEBHOOK_SECRET`, `PAYMONGO_ALLOWED_PAYMENT_METHODS`, `PAYMONGO_DEFAULT_PAYMENT_METHODS`
  - OTP: `OTP_REDIS_URL` or `REDIS_URL`
  - SMS: `SMS_REDIS_URL` or `REDIS_URL`
  - Email: `RESEND_API_KEY`
  - Google auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Geo: `GOOGLE_MAPS_API_KEY`

## Manual Verification

Use these checks after deploying or changing secrets:

```powershell
curl.exe https://api-center.itsandbox.site/api/v1/health/ready
curl.exe https://api-center.itsandbox.site/api/v1/metrics
```

Expected API Center readiness:

```text
kafka: up
redis: up
registry: up
```

Expected Kafka metric:

```text
kafka_producer_connected 1
```

## Dashboard Panels

Create these first panels in Prometheus/Grafana or Google Cloud Managed Prometheus:

- API Center readiness state
- Kafka producer connected state
- Kafka publish failures over 5 minutes
- shared-service request volume by service
- shared-service 5xx count by service
- pod restarts by workload

## Notes

Prometheus and Grafana are not required before the services can run. They are required before claiming production operations are complete, because failures need an operator-facing signal instead of only manual log inspection.
