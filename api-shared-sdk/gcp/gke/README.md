# Shared Services GKE Deployment

These manifests deploy the platform-owned shared services into the existing
`api-center` namespace. They are internal `ClusterIP` services only; API Center
remains the single public entrypoint.

## Runtime Shape

| Service ID | Deployment | Kubernetes service | Port |
| --- | --- | --- | ---: |
| `payment` | `payment-service` | `payment-service` | 4010 |
| `sms` | `sms-service` | `sms-service` | 4011 |
| `email` | `email-service` | `email-service` | 4012 |
| `gauth` | `gauth-service` | `gauth-service` | 4013 |
| `otp` | `otp-service` | `otp-service` | 4014 |
| `geo` | `geo-service` | `geo-service` | 4015 |

Each deployment starts at 1 replica and has an HPA from 1 to 3 replicas.
Kubernetes will recreate a failed 1-replica pod, but that is not the same as
high availability. Raise the HPA minimum to 2 for services that need one pod to
remain available during restarts.

## Secret Flow

The shared-service pods consume one Kubernetes secret:

```text
api-shared-services-prod
```

That Kubernetes secret is synced from GCP Secret Manager:

```text
GCP Secret Manager api-shared-services-prod
  -> Kubernetes Secret api-shared-services-prod
  -> envFrom in each shared-service pod
```

After changing Secret Manager values, run the sync script and restart the
affected deployment. Existing pods do not automatically reload environment
variables.

Optional database keys also belong in `api-shared-services-prod`:

```env
SHARED_SERVICES_DATABASE_ENABLED=false
SHARED_SERVICES_DATABASE_URL=postgresql://shared_services_app:<password>@<supabase-pooler-host>:6543/postgres?pgbouncer=true
PAYMENT_SUBSCRIPTIONS_ENABLED=false
```

Keep the flag disabled until Supabase migrations are applied and the
target shared-service gateway has runtime persistence tests.

`PAYMENT_SUBSCRIPTIONS_ENABLED=false` is also set explicitly in the production
`payment-service` manifest. The test overlay changes only the test
`payment-service` deployment to `"true"` so subscription smoke checks can run
before live recurring payments are approved.

## Deploy

Build and push images from the `shared-services` directory:

```powershell
$project = "api-center-496422"
$repo = "asia-southeast1-docker.pkg.dev/$project/api-center"
$tag = git rev-parse --short HEAD

docker build -t "$repo/shared-payment-service:$tag" -f paymongo/Dockerfile .
docker build -t "$repo/shared-sms-service:$tag" -f sms-gateway/Dockerfile .
docker build -t "$repo/shared-email-service:$tag" -f email-gateway/Dockerfile .
docker build -t "$repo/shared-gauth-service:$tag" -f gauth-gateway/Dockerfile .
docker build -t "$repo/shared-otp-service:$tag" -f otp-gateway/Dockerfile .
docker build -t "$repo/shared-geo-service:$tag" -f geo-gateway/Dockerfile .

docker push "$repo/shared-payment-service:$tag"
docker push "$repo/shared-sms-service:$tag"
docker push "$repo/shared-email-service:$tag"
docker push "$repo/shared-gauth-service:$tag"
docker push "$repo/shared-otp-service:$tag"
docker push "$repo/shared-geo-service:$tag"
```

Sync secrets and apply manifests:

```powershell
.\scripts\sync-gke-secret.ps1
kubectl apply -f gcp/gke/00-shared-services.yaml
kubectl -n api-center rollout status deploy/payment-service --timeout=5m
kubectl -n api-center rollout status deploy/sms-service --timeout=5m
kubectl -n api-center rollout status deploy/email-service --timeout=5m
kubectl -n api-center rollout status deploy/gauth-service --timeout=5m
kubectl -n api-center rollout status deploy/otp-service --timeout=5m
kubectl -n api-center rollout status deploy/geo-service --timeout=5m
```

### Test namespace

For the test API Center environment, sync the test secret and apply the overlay:

```powershell
.\scripts\sync-gke-secret.ps1 `
  -ProjectId api-center-496422 `
  -SecretName api-shared-services-test `
  -Namespace api-center-test `
  -KubernetesSecretName api-shared-services-test

kubectl kustomize gcp/gke/test --load-restrictor LoadRestrictionsNone | kubectl apply -f -
```

The overlay reuses the production shared-service manifests but changes the
namespace to `api-center-test` and the secret reference to
`api-shared-services-test`. It also enables
`PAYMENT_SUBSCRIPTIONS_ENABLED=true` only on the test `payment-service`
deployment.

Optional shared-service database migration, from the repo root:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Verify registration through API Center:

```powershell
curl.exe https://api-center.itsandbox.site/api/v1/shared
```
