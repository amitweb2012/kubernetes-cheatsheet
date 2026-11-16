# Platform API Stack — Kubernetes Portfolio Project

A production-minded learning project demonstrating an API edge, Kubernetes ingress, a stateless Node.js API, Redis caching, PostgreSQL persistence, Helm packaging, and Kubernetes security controls.

> **Learning architecture:** Client → Kong API Gateway → NGINX Ingress → Kubernetes Service → API Deployment/Pods → Redis + PostgreSQL.

## Architecture

\x60\x60\x60mermaid
flowchart TB
  Browser["Browser"] --> Ingress["NGINX Ingress"]
  Ingress -->|/| WebSvc["Next.js Service"]
  WebSvc --> WebPods["Next.js Deployment / Pods"]
  Ingress -->|/api/*| ApiSvc["Express API Service"]
  WebPods -. "same-origin browser requests" .-> Ingress
  ApiSvc --> ApiPods["Express API Deployment / Pods"]
  ApiPods --> Redis["Redis cache"]
  ApiPods --> Postgres["PostgreSQL StatefulSet"]
  Postgres --> PVC["PersistentVolumeClaim"]
  Kong["Optional Kong Gateway"] -. "edge entry point" .-> Ingress
  subgraph Cluster["Kubernetes cluster"]
    Ingress
    WebSvc
    WebPods
    ApiSvc
    ApiPods
    Redis
    Postgres
    PVC
  end
\x60\x60\x60

Kong is the north-south API gateway in front of the cluster ingress. NGINX Ingress routes the request to the application Service. In a smaller deployment, Kong or an ingress controller may perform both gateway and ingress responsibilities; this project keeps the layers separate to make the concepts visible.

## Project structure

```text
platform-api-stack/
├── app/
│   ├── src/server.js
│   ├── package.json
│   └── Dockerfile
├── kong/
│   └── kong.yml
├── helm/platform-api-stack/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── configmap.yaml
│       ├── api-deployment.yaml
│       ├── api-service.yaml
│       ├── ingress.yaml
│       ├── redis.yaml
│       ├── postgres.yaml
│       ├── networkpolicy.yaml
│       └── NOTES.txt
├── .dockerignore
└── README.md
```

## Components

| Component | Responsibility |
|---|---|
| Kong | API gateway example: edge authentication, rate limiting and routing |
| NGINX Ingress | Cluster HTTP routing using host/path rules |
| Next.js Deployment | Serves the browser UI and static assets |\n| API Deployment | Runs stateless Express API replicas |
| ClusterIP Service | Stable in-cluster API endpoint |
| Redis | Cache for note reads |
| PostgreSQL StatefulSet | Persistent relational data |
| Helm | Repeatable, configurable installation |
| NetworkPolicy | Example default-deny ingress posture with explicit API dependencies |

## Prerequisites

- Docker
- Kubernetes cluster (KinD or Minikube)
- kubectl
- Helm 3
- An NGINX Ingress Controller installed in the cluster
- A StorageClass that can provision a PVC
- Optional: Kong Gateway, when testing the full external gateway hop

## 1. Build the API image

From the repository root:

```bash
docker build -t platform-api:1.0.0 ./projects/platform-api-stack/app
docker build -t platform-web:1.0.0 ./projects/platform-api-stack/web
```

For KinD, load the image into the cluster:

```bash
kind load docker-image platform-api:1.0.0 --name learning-cluster
kind load docker-image platform-web:1.0.0 --name learning-cluster
```

For Minikube, build directly into its Docker environment or load the image:

```bash
minikube image load platform-api:1.0.0
minikube image load platform-web:1.0.0
```

## 2. Create credentials outside Git

The chart intentionally references an existing Secret. Create it in the target namespace; do not commit real credentials.

```bash
kubectl create namespace platform
kubectl -n platform create secret generic platform-api-secrets \
  --from-literal=DATABASE_URL='postgres://platform_user:CHANGE_ME@platform-api-stack-postgres:5432/platform' \
  --from-literal=POSTGRES_USER='platform_user' \
  --from-literal=POSTGRES_PASSWORD='CHANGE_ME' \
  --from-literal=POSTGRES_DB='platform' \
  --from-literal=REDIS_URL='redis://platform-api-stack-redis:6379' \\
  --from-literal=OIDC_ISSUER='https://identity.example.com/realms/platform' \\
  --from-literal=OIDC_AUDIENCE='platform-notes'

kubectl -n platform create secret generic platform-web-secrets \\
  --from-literal=OIDC_ISSUER='https://identity.example.com/realms/platform' \\
  --from-literal=OIDC_CLIENT_ID='platform-notes' \\
  --from-literal=OIDC_CLIENT_SECRET='REPLACE_WITH_CLIENT_SECRET' \\
  --from-literal=NEXTAUTH_SECRET="$(openssl rand -base64 32)" \\
  --from-literal=NEXTAUTH_URL='https://app.platform.local'
```

Use strong unique passwords and a secret manager for shared or production clusters. Kubernetes Secret values are base64-encoded, not encrypted by base64; enable encryption at rest and restrict RBAC.

## 3. Install with Helm

Check the StorageClass name first:

```bash
kubectl get storageclass
```

Install using the matching class and your image settings:

```bash
helm upgrade --install platform-api-stack \
  ./projects/platform-api-stack/helm/platform-api-stack \
  --namespace platform \
  --set api.image.repository=platform-api \
  --set api.image.tag=1.0.0 \
  --set api.image.pullPolicy=IfNotPresent \
  --set postgresql.storageClassName=<YOUR_STORAGE_CLASS>
```

If using a local chart image, ensure the image is loaded into the same cluster. Review the chart before installing:

```bash
helm lint ./projects/platform-api-stack/helm/platform-api-stack
helm template platform-api-stack ./projects/platform-api-stack/helm/platform-api-stack -n platform
```

## 4. Verify workloads

```bash
kubectl get pods,svc,pvc -n platform
kubectl rollout status deployment/platform-api-stack-api -n platform
kubectl rollout status statefulset/platform-api-stack-postgres -n platform
kubectl logs deployment/platform-api-stack-api -n platform
```

## OAuth 2.0 / OpenID Connect login

The web dashboard uses NextAuth with the Keycloak OIDC provider and the Authorization Code flow with PKCE/state checks. The browser receives a secure NextAuth session cookie; the access token stays server-side and is forwarded by the Next.js API route to Express as a Bearer token. Express validates the JWT signature against the identity provider's JWKS and checks issuer and audience before allowing note or database-operations requests.

Configure a confidential Keycloak client with:
- Client ID: `platform-notes` (or your chosen ID)
- Client authentication: enabled
- Standard authorization code flow: enabled
- Valid redirect URI: `https://app.platform.local/api/auth/callback/keycloak`
- Web origin: `https://app.platform.local`
- PKCE: S256
- An access-token audience mapper that includes the client ID as `platform-notes` (or set `OIDC_AUDIENCE` to the audience emitted by your provider)

Set `OIDC_ISSUER` to the realm issuer URL (for Keycloak, for example `https://identity.example.com/realms/platform`). The API Secret needs `OIDC_ISSUER` and `OIDC_AUDIENCE`; the web Secret needs `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`. The chart injects `API_INTERNAL_URL` for server-to-server calls. The web server refreshes expired access tokens using the provider's refresh token. Never expose the client secret or NextAuth secret to browser-side variables.

When NetworkPolicies are enabled, set `api.oidcEgressCIDRs` and `web.oidcEgressCIDRs` in Helm values to the trusted identity provider's HTTPS IP ranges (port 443); leave them empty only when the provider is reachable through an allowed in-cluster route. NetworkPolicy cannot select a remote service by DNS name, so keep these CIDRs narrow and maintain them if the provider's addresses change.

The API's `/health/*` endpoints remain unauthenticated for Kubernetes probes. Notes and database-operations endpoints require a valid access token. The separate `api.platform.local` host is intended for direct API clients that send their own Bearer token; the dashboard host routes `/api/*` through Next.js so the session token is not exposed to browser JavaScript.

## Dashboard database and migration panels

The dashboard calls the authenticated `/api/v1/ops/database` endpoint. It returns safe operational metadata (database name, PostgreSQL version, note row count, Redis status and applied migration filenames/timestamps); it never returns connection strings, passwords or secret values. The notes schema migration `004_add_note_category.sql` adds a persisted category column, and the notes API plus seed data now read/write that category.

## Database migrations and sample data

The API no longer creates tables during startup. Apply versioned SQL migrations before starting the API. The migration runner records applied files in `schema_migrations`, runs each file in a transaction, and uses a PostgreSQL advisory lock to prevent concurrent migration runs.

### Run locally

Start PostgreSQL and set the connection string in your shell:

```bash
cd projects/platform-api-stack/app
export DATABASE_URL='postgres://platform_user:CHANGE_ME@localhost:5432/platform'
npm install
npm run db:migrate
npm run db:seed
npm start
```

- `db/migrations/001_create_notes_table.sql` creates the original notes table (safe for an existing table).
- `002_add_note_metadata.sql` adds update timestamps and an optional unique seed key.
- `003_import_legacy_notes.sql` creates a small legacy table and imports its sample records into the current notes table.
- `004_add_note_category.sql` adds a persisted category to notes and backfills existing rows.
- `db/seed.sql` inserts five repeatable demo notes. Running it again updates those demo rows instead of duplicating them.
- `src/db/migrate.js` applies migrations in filename order and tracks them.
- `src/db/seed.js` executes the sample-data script.

### Run against the Kubernetes database

After creating the namespace and PostgreSQL Secret, start a temporary client Pod with the API image (which includes the migration scripts):

```bash
kubectl run platform-db-migrate -n platform --rm -it --restart=Never \
  --image=platform-api:1.0.0 \\
  --env="DATABASE_URL=postgres://platform_user:CHANGE_ME@platform-api-stack-postgres:5432/platform" \\
  --command -- node src/db/migrate.js
```

Run the same command with `node src/db/seed.js` to load demo notes. For a shared cluster, use a Pod spec that references the existing Kubernetes Secret rather than putting the password on the command line.

For an existing database created by the earlier sample API, migration 001 leaves the `notes` table intact; the later migrations add metadata and import the example legacy rows. Back up real data before applying schema changes. These scripts are educational examples: review them and test migrations/rollback procedures against a disposable database first.

## 5. Test the API

Port-forward the API Service:

```bash
kubectl port-forward -n platform svc/platform-api-stack-api 3000:3000
```

In another terminal:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/api/v1/notes
curl -X POST http://localhost:3000/api/v1/notes \
  -H 'content-type: application/json' \
  -d '{"title":"Learn Kubernetes","content":"Deploy API, Redis and PostgreSQL"}'
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/v1/notes
```

The notes endpoint writes to PostgreSQL and caches the list in Redis. Creating a note invalidates the list cache.

## 6. Enable ingress routing

The chart creates an Ingress for `api.platform.local` by default. Ensure the NGINX Ingress Controller is installed and that its IngressClass is named `nginx`.

For local testing, map the hostname to your local ingress address (for example, add an entry to `/etc/hosts`) or use port-forwarding to the ingress controller. Then:

```bash
curl -H 'Host: api.platform.local' http://<INGRESS_ADDRESS>/health/ready
```

## 7. Kong API Gateway example

`kong/kong.yml` is a DB-less declarative configuration example. It defines a route to the NGINX ingress endpoint and demonstrates rate limiting. Adapt the upstream URL and deploy Kong using its official Helm chart or your gateway platform. Do not expose the Kong Admin API publicly.

This repo does not install Kong automatically: gateway deployment and external load-balancer/DNS/TLS setup are environment-specific. The API can be tested directly through ingress first, then place Kong in front of the ingress endpoint.

## 8. Security controls demonstrated

- API container runs as non-root with a read-only root filesystem and dropped Linux capabilities.
- API ServiceAccount token automount is disabled.
- Secrets are injected from a pre-created Kubernetes Secret.
- PostgreSQL is not exposed through an external Service.
- NetworkPolicy limits API ingress to ingress-controller Pods and API egress to DNS, Redis and PostgreSQL.
- Resource requests/limits and startup/readiness/liveness probes are configured.
- PostgreSQL and Redis are internal-only Services.

**NetworkPolicy requires a CNI that enforces NetworkPolicy.** The sample ingress-controller namespace selector is a common default but may need adjustment for your controller installation. Verify labels with `kubectl get ns --show-labels`.

## 9. Useful operations

```bash
# Scale API
kubectl scale deployment/platform-api-stack-api -n platform --replicas=3

# Inspect API
kubectl describe deployment/platform-api-stack-api -n platform
kubectl logs -f deployment/platform-api-stack-api -n platform

# Check network policies
kubectl get networkpolicy -n platform

# Upgrade / uninstall
helm upgrade platform-api-stack ./projects/platform-api-stack/helm/platform-api-stack -n platform
helm uninstall platform-api-stack -n platform
```

Uninstalling the chart does not necessarily delete PVCs. Review and back up persistent data before deleting claims.

## Learning exercises

1. Increase API replicas and observe Service load distribution.
2. Temporarily scale Redis to zero and observe the API's readiness and error handling.
3. Change the ingress hostname and test host-based routing.
4. Add a Kong key-auth plugin and protect a route with a consumer credential.
5. Restrict the NetworkPolicy to a dedicated namespace label.
6. Add TLS using cert-manager and a trusted certificate.
7. Replace local image loading with a registry and immutable image digest.
8. Add Prometheus metrics and a Grafana dashboard.

## Production hardening checklist

- [ ] Use managed PostgreSQL/Redis or design backups, HA, upgrades and restore tests.
- [ ] Use TLS from client to gateway and from gateway to ingress where required.
- [ ] Use external secret management and encryption at rest.
- [ ] Pin image digests and scan images.
- [ ] Configure PodDisruptionBudgets, autoscaling and topology spread.
- [ ] Add observability, audit logging, alerting and tracing.
- [ ] Validate NetworkPolicies with the cluster's CNI.
- [ ] Review resource sizing, connection pools, timeouts and retry behavior.
- [ ] Test database migrations and rollback procedures.

## Notes

This is an educational reference stack, not a claim of production readiness. Redis and PostgreSQL are single-instance examples. For production, use managed services or add replication, backups, recovery, TLS, monitoring and operational runbooks.


---

# Production deployment runbook (future reference)

This section is a **step-by-step preparation guide** for turning the learning stack into a production deployment. Follow it in a staging environment first. The current Helm chart is a reference implementation: it deploys single-instance Redis and PostgreSQL examples and does not, by itself, provide production-grade database high availability, automated backups, managed TLS, autoscaling, or a complete migration Job. Do not treat a successful Helm install as proof that the system is production-ready.

## Production target architecture

Recommended production shape:

- Users → DNS → HTTPS load balancer / ingress or API gateway
- Next.js dashboard → Express API (same-origin browser requests through Next.js)
- Keycloak or another OIDC provider for user authentication
- Express API → managed PostgreSQL and managed Redis over private networking
- Container images → private container registry, deployed by immutable digest
- Secrets → cloud secret manager or external-secrets integration
- Logs, metrics, traces and alerts → centralized observability platform

Prefer managed PostgreSQL and Redis for the first production deployment. Keep the in-cluster StatefulSets for local learning or non-critical environments unless you have designed and tested replication, failover, backup, restore, patching and storage operations.

## Phase 0 — Decide the production environment

Before provisioning infrastructure, record these values in an environment-specific deployment plan (do not put secrets in this README):

| Setting | Example / decision |
|---|---|
| Kubernetes provider | EKS, AKS, GKE or an approved Kubernetes platform |
| Namespace | `platform` |
| Public dashboard URL | `https://notes.example.com` |
| API access | Same-origin through the Next.js proxy; direct API only if required |
| OIDC issuer | Your identity provider's HTTPS realm/tenant issuer |
| OIDC client ID | `platform-notes` |
| PostgreSQL | Managed instance, private endpoint, TLS required |
| Redis | Managed instance, private endpoint, TLS/auth required |
| Container registry | Approved private registry |
| Ingress class | The class installed by your platform team |
| StorageClass | Only needed if you deliberately retain in-cluster PostgreSQL |
| Secret manager | AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, or approved equivalent |
| Recovery objectives | Agree RPO, RTO, retention and restore ownership |

Also decide expected traffic, availability target, data classification, retention, region, maintenance window, budget, and who is on call.

## Phase 1 — Prepare the repository and release

1. Review and merge the feature PR only after code review and the test gates below pass.
2. Work from a clean checkout of the approved commit:
   ```bash
   git checkout main
   git pull --ff-only
   git rev-parse HEAD
   ```
3. Record the commit SHA in the release ticket. Do not deploy a moving branch name.
4. Review application configuration and remove local-only hostnames such as `*.platform.local`.
5. Confirm that no credentials, tokens, private keys, production dumps, or real customer data are committed:
   ```bash
   git grep -n -i -E 'password=|client_secret|BEGIN PRIVATE KEY|postgres://[^ ]+:[^ ]+@' || true
   ```
   Review matches manually; examples and placeholders may also match.
6. Create a release tag only after the build and test pipeline passes, for example:
   ```bash
   git tag -a platform-api-stack-v1.0.0 -m "Platform API Stack v1.0.0"
   git push origin platform-api-stack-v1.0.0
   ```

## Phase 2 — Provision production infrastructure

1. Create a dedicated Kubernetes cluster or approved namespace with separate staging and production access.
2. Configure private cluster-to-database networking. Do not expose PostgreSQL or Redis publicly.
3. Provision managed PostgreSQL and Redis with encryption in transit and at rest.
4. Configure PostgreSQL automated backups / point-in-time recovery and a retention policy. Perform a restore test into a separate instance before launch.
5. Configure Redis authentication and TLS. Decide whether Redis is only a cache (safe to flush/rebuild) or stores any durable state. This project uses it as a cache.
6. Configure a private container registry and image pull permissions.
7. Install and configure the supported ingress controller or gateway, external load balancer, DNS and certificate management.
8. Configure cluster autoscaling and node pools, resource quotas, namespace limits, and a supported CNI that enforces NetworkPolicy.
9. Apply organization-approved RBAC and audit logging. Use separate identities for CI/CD, operators and application workloads.

Capture endpoint names and resource identifiers in the deployment system, not in source control.

## Phase 3 — Configure OAuth 2.0 / OpenID Connect

The dashboard uses the OIDC Authorization Code flow with PKCE through NextAuth. Express validates bearer access tokens. Configure the identity provider before deploying the web application.

1. Create a confidential OIDC client for the production dashboard.
2. Enable Authorization Code flow; require PKCE with S256 where supported. Disable implicit and password grants.
3. Register the exact callback URL:
   `https://notes.example.com/api/auth/callback/keycloak`
   Replace the host with the real dashboard hostname. Do not use wildcard redirect URIs in production.
4. Register the exact production web origin.
5. Configure an access-token audience mapper so the API receives the audience configured as `OIDC_AUDIENCE`.
6. Configure least-privilege roles / groups and decide which roles may read, create, update or delete notes and view operational metadata. Verify that authorization is enforced server-side; authentication alone is not an authorization policy.
7. Set the issuer to the exact HTTPS issuer URL published by the identity provider.
8. Store the client secret and NextAuth secret in the secret manager. Generate a high-entropy NextAuth secret; never reuse development secrets.
9. Configure short-lived access tokens and a refresh-token rotation/revocation policy consistent with your identity provider.
10. Test login, logout, expired access token, refresh-token rotation, revoked session, wrong issuer, wrong audience, invalid signature and unauthorized role.

Production web Secret keys used by this project:
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (must be the public HTTPS dashboard URL)

Production API Secret keys used by this project:
- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- `DATABASE_URL`
- `REDIS_URL`

Use the exact variable names expected by the checked-out application code. Do not add a `NEXT_PUBLIC_` prefix to secrets or tokens. The browser must not receive the OIDC client secret, refresh token, database URL, or API signing/verification configuration.

## Phase 4 — Create and validate production secrets

1. Create secrets in the approved secret manager, not in Git, Helm values committed to Git, shell history, tickets or chat.
2. Prefer an External Secrets Operator / CSI driver or the cloud provider's supported secret integration to synchronize secrets into the Kubernetes namespace.
3. If you create Kubernetes Secrets manually for a controlled test, use a secure terminal and avoid putting literal credentials in command history. Do not use the example credentials from the learning section.
4. Enable Kubernetes Secret encryption at rest and restrict read access using RBAC.
5. Rotate credentials and document the rotation procedure. Ensure the application can be rolled safely during rotation.
6. Confirm the database role is not a superuser and has only the permissions needed by the API and migration process. Prefer a separate, more privileged migration identity if your operational model supports it.

The example chart references existing Secrets named by `api.existingSecret` and `web.existingSecret`. Confirm the rendered Deployment references the correct Secret names before applying it.

## Phase 5 — Build, scan and publish immutable images

Build from the approved repository commit using the CI pipeline:

```bash
docker build --pull -t platform-api:$GIT_SHA ./projects/platform-api-stack/app
docker build --pull -t platform-web:$GIT_SHA ./projects/platform-api-stack/web
```

Then:

1. Run dependency and source-code security scans.
2. Generate an SBOM and scan both images for vulnerabilities.
3. Push images to the private registry.
4. Record their immutable digests (`sha256:...`).
5. Configure the cluster's image-pull identity.
6. Deploy by digest where the chart supports it, or extend the chart to accept an image digest. Do not rely on mutable tags such as `latest`.
7. Verify the image provenance and ensure the deployed digest matches the release record.

The current chart values expose image repository, tag and pull policy. Before production, extend and review the chart if your registry requires digest pinning, imagePullSecrets, signature verification or admission policy.

## Phase 6 — Review Helm configuration before deployment

1. Create a production-specific values file outside the public repository or store only non-secret configuration in a protected deployment repository.
2. Set:
   - `api.image.repository`, `api.image.tag`, `api.replicaCount`
   - `web.image.repository`, `web.image.tag`, `web.replicaCount`
   - `api.ingress.host`, `web.ingress.host`, and the actual ingress class
   - `api.existingSecret` and `web.existingSecret`
   - production resource requests and limits based on load tests
   - `api.oidcEgressCIDRs` and `web.oidcEgressCIDRs` if NetworkPolicy requires fixed identity-provider egress IP ranges
   - `networkPolicy.enabled` and the correct ingress-controller namespace label/value
2. Use managed PostgreSQL and Redis endpoints through the API Secret. Do not deploy the chart's sample PostgreSQL/Redis StatefulSets in production unless you have explicitly accepted and engineered their operational risks. The current chart does not provide a complete switch to disable those workloads; extend and test the chart before using managed services.
3. Configure TLS at the ingress/gateway and redirect HTTP to HTTPS. Verify certificate renewal and expiry alerting.
4. Review all rendered Kubernetes objects:
   ```bash
   helm lint ./projects/platform-api-stack/helm/platform-api-stack
   helm template platform-api-stack ./projects/platform-api-stack/helm/platform-api-stack \
     --namespace platform \
     --values ./deploy/production-values.yaml > rendered-production.yaml
   ```
5. Review the rendered output for public database Services, missing Secret references, incorrect hostnames, overly broad NetworkPolicies, privileged containers, missing resource limits, and accidental plaintext configuration.
6. Keep the rendered file in the protected CI artifact store if it contains environment metadata; never publish secrets in build logs.

## Phase 7 — Test the release in staging

Do not skip staging. Use production-like networking and identity-provider configuration but synthetic data.

Required checks:
- API liveness and readiness probes succeed.
- Web application loads and can authenticate through the production-like OIDC flow.
- Authenticated users can create and list notes.
- Unauthenticated requests to protected API endpoints return 401/403 as designed.
- A user without the required role cannot perform privileged actions.
- Database operational endpoint reports expected PostgreSQL, Redis and migration status without exposing secrets.
- Redis failure behaves as designed and does not corrupt PostgreSQL data.
- PostgreSQL restart/failover and connection interruption are handled safely.
- Ingress routes, TLS, DNS and browser cookie settings work.
- NetworkPolicies allow only required traffic.
- Load, soak and basic resilience tests pass.
- Logs do not contain bearer tokens, refresh tokens, passwords, connection strings or note content that should be private.

Example smoke tests (use the real staging URL and a short-lived test token only in a secure shell):

```bash
curl --fail https://notes-staging.example.com/
curl --fail https://notes-staging.example.com/api/health/ready
curl -i https://notes-staging.example.com/api/v1/notes
```

The last request should be rejected when no authenticated session/token is supplied. Use the dashboard for the normal browser flow.

## Phase 8 — Back up data and run database migrations

**Always take and verify a backup before a production schema change.** Confirm the backup is restorable; a backup job that has never been restored is not a proven recovery plan.

1. Review every pending SQL migration and identify locks, table rewrites, index creation time, compatibility and rollback strategy.
2. Test the migration against a recent sanitized copy of production data and measure its duration.
3. Confirm the currently deployed application is compatible with the post-migration schema. Prefer expand-and-contract migrations:
   - add nullable/new structures first;
   - deploy code compatible with both old and new schema;
   - backfill in controlled batches;
   - switch reads/writes;
   - remove old structures in a later release.
4. Put the application in maintenance/read-only mode only if the migration requires it.
5. Take a database backup or provider snapshot and record its identifier.
6. Run exactly one migration process. The migration runner uses a PostgreSQL advisory lock, but the release process should still ensure a single controlled migration execution.
7. Run migrations using a dedicated one-off Job or release pipeline identity. The temporary `kubectl run` command in the learning section is for manual testing; for production, create a reviewed Kubernetes Job manifest with:
   - the exact release image digest;
   - database Secret references (never literal credentials);
   - `restartPolicy: Never`, bounded retries and an active deadline;
   - resource requests/limits and restricted security context;
   - logs and a clear success/failure gate.
8. Wait for Job completion and inspect logs. Do not roll out the new API if the migration failed.
9. Run post-migration checks: expected migration filenames in `schema_migrations`, expected schema, row counts, indexes and application smoke tests.
10. Seed only synthetic/demo data in non-production. Do not run `db:seed` against a production database unless the seed contents and purpose have been explicitly reviewed and approved.

The current migration runner applies ordered SQL files transactionally and records them in `schema_migrations`. A transaction does not make every possible PostgreSQL operation reversible, so write and test a recovery plan for each migration. Do not assume a down migration exists.

## Phase 9 — Deploy the application

After staging approval and successful migration:

1. Confirm the release SHA, image digests, values file and migration result.
2. Deploy using the approved CI/CD pipeline and production environment approval.
3. Apply the Helm release:
   ```bash
   helm upgrade --install platform-api-stack \
     ./projects/platform-api-stack/helm/platform-api-stack \
     --namespace platform \
     --values ./deploy/production-values.yaml \
     --wait --timeout 10m
   ```
   Use this command only after the chart has been adapted and validated for the production topology described above.
4. Watch rollout status:
   ```bash
   kubectl get pods,svc,ingress -n platform
   kubectl rollout status deployment/platform-api-stack-api -n platform
   kubectl rollout status deployment/platform-api-stack-web -n platform
   ```
5. Verify the deployed image digests, environment variables by name (not by printing secret values), probes, replica counts, NetworkPolicies and ingress TLS.
6. Run smoke tests and sign-in tests. Confirm the dashboard reports healthy dependencies and the expected migration version.
7. Keep the previous release image and deployment metadata available for rollback.

## Phase 10 — Observability and operational readiness

Before opening traffic, configure:

- Structured application logs with correlation/request IDs and centralized retention.
- Metrics for request rate, error rate, latency, saturation, Node.js process health, PostgreSQL connections/replication/storage, Redis memory/evictions and Kubernetes restarts.
- Distributed tracing across ingress, Next.js, Express and database calls where supported.
- Alerts for elevated 5xx rates, latency, failed login spikes, repeated token refresh failures, database connection exhaustion, storage pressure, backup failures, certificate expiry, pod crash loops and failed migration Jobs.
- Audit logs for identity and administrative actions.
- Dashboards and an on-call owner for every critical alert.

Never log access tokens, refresh tokens, client secrets, passwords, connection strings or sensitive note contents.

## Phase 11 — Rollback and recovery

Application rollback and database rollback are different operations.

1. If the new application is unhealthy, stop further rollout and use the recorded previous release to roll back the application:
   ```bash
   helm history platform-api-stack -n platform
   helm rollback platform-api-stack <PREVIOUS_REVISION> -n platform --wait
   ```
2. Check whether the previous application version is compatible with the new database schema. This is why expand-and-contract migrations are preferred.
3. Do not blindly reverse SQL or restore an old database snapshot over live writes. A database restore can lose data created after the snapshot.
4. For data corruption or an unrecoverable schema issue, follow the approved database point-in-time recovery procedure and incident command process.
5. Record the incident timeline, affected release SHA, migration version, recovery point and data-loss assessment.
6. Re-run smoke tests and verify backup/replication health before reopening traffic.

## Phase 12 — Go-live checklist

- [ ] Production DNS points to the approved ingress/load balancer.
- [ ] HTTPS works; HTTP redirects to HTTPS; certificate renewal is monitored.
- [ ] OIDC redirect URI, issuer, audience, roles and logout behavior are verified.
- [ ] Secrets are supplied by the secret manager and are not present in Git or logs.
- [ ] PostgreSQL and Redis are private, encrypted and monitored.
- [ ] PostgreSQL backup and point-in-time recovery have been restore-tested.
- [ ] Migration was tested on staging and executed once with a recorded result.
- [ ] Images are scanned, provenance checked and deployed by immutable digest.
- [ ] Helm templates, RBAC, NetworkPolicies and resource limits have been reviewed.
- [ ] Staging load, resilience and security checks passed.
- [ ] Alerts, dashboards, logs, traces and on-call ownership are active.
- [ ] Rollback and disaster-recovery procedures are documented and rehearsed.
- [ ] Business/data owner approved the go-live.

## Suggested future improvements to this repository

These are follow-up engineering tasks; they are not implied to exist in the current chart:

1. Add a Helm hook or release-pipeline Kubernetes Job for database migrations, with Secret references and image digest pinning.
2. Add chart options to disable bundled PostgreSQL and Redis when managed services are configured.
3. Add support for image digests, imagePullSecrets and verified image provenance.
4. Add PodDisruptionBudgets, HPA, topology spread constraints and anti-affinity for web/API workloads.
5. Add a production ingress TLS example and cert-manager integration.
6. Add automated integration tests using disposable PostgreSQL, Redis and a test OIDC provider.
7. Add CI checks for unit/integration tests, dependency scanning, container scanning, SBOM generation, Helm lint and rendered-manifest policy checks.
8. Add tested backup/restore and migration recovery runbooks.


## GitHub Actions CI/CD pipeline

The repository workflow at `.github/workflows/ci-docker.yml` builds and validates this project. It is scoped to changes under `projects/platform-api-stack/**` (and changes to the workflow itself), so unrelated Kubernetes examples do not trigger this pipeline.

### Pull request checks

For pull requests that touch this project, GitHub Actions:

1. Installs API dependencies and checks JavaScript syntax.
2. Installs frontend dependencies and runs the Next.js production build.
3. Runs `helm lint` against the chart.
4. Renders the chart with `helm template`.
5. Builds the API and web Docker images without publishing them.

### Main branch publishing

After changes are pushed or merged to `main`, the workflow repeats validation and publishes these Docker Hub images:

- `<DOCKERHUB_USERNAME>/platform-api:latest`
- `<DOCKERHUB_USERNAME>/platform-api:sha-<commit>`
- `<DOCKERHUB_USERNAME>/platform-web:latest`
- `<DOCKERHUB_USERNAME>/platform-web:sha-<commit>`

Configure the following repository Actions secrets before merging to `main`:

- `DOCKERHUB_USERNAME`: Docker Hub username / namespace.
- `DOCKERHUB_TOKEN`: Docker Hub access token with permission to push images.

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Do not put Docker Hub credentials in workflow YAML or commit them to the repository.

### Run manually

The workflow also supports **Actions → CI - Platform API Stack → Run workflow**.

### Important scope

This pipeline validates application syntax/builds, Helm rendering and Docker image builds. It does not connect to a live PostgreSQL/Redis instance, execute database migrations against production, deploy to a Kubernetes cluster, or prove that OAuth login works end to end. Those require separate integration tests and a controlled deployment workflow. The current app directories do not contain committed npm lockfiles, so dependency installation uses `npm install`; adding and committing lockfiles would allow reproducible `npm ci` installs.


## Integration tests: PostgreSQL and Redis

The API integration test suite is in `app/test/integration.test.js` and runs with Node's built-in test runner. It uses real PostgreSQL and Redis services rather than mocks.

Run it locally after starting PostgreSQL and Redis and applying the environment variables:

```bash
cd projects/platform-api-stack/app
npm install
DATABASE_URL='postgres://platform_test:platform_test@localhost:5432/platform_test' \
REDIS_URL='redis://localhost:6379' \
npm run test:integration
```

The test runs the project's migration runner, verifies the notes schema and migration history, writes and reads a note in PostgreSQL, then exercises Redis set/get/delete cache behavior. Use a disposable test database: migrations create schema objects and the test writes a row. Do not point this test at production.

GitHub Actions starts PostgreSQL 16 and Redis 7 service containers for the validation job and runs these integration tests before building images. The job uses ephemeral test credentials only.

## Manual deployment workflow: AWS EKS or Azure AKS

The separate workflow is `.github/workflows/deploy-platform-api-stack.yml`. It is intentionally **manual** and deploys only when dispatched from `main`. It supports either AWS EKS or Azure AKS, runs the database migration Job first, then deploys the API and web images with Helm. Configure a protected GitHub Environment named `production` with required reviewers before using it.

### Common prerequisites

1. The target Kubernetes cluster already exists and GitHub Actions can authenticate to it using workload identity federation (OIDC). Do not create long-lived cloud access keys for this workflow.
2. The target namespace already exists.
3. Create the Kubernetes Secrets before the first deployment:
   - `platform-api-secrets` with `DATABASE_URL`, `REDIS_URL`, `OIDC_ISSUER`, and `OIDC_AUDIENCE`.
   - `platform-web-secrets` with `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
4. Ensure the cluster can pull the Docker Hub images. If the repositories are private, configure an imagePullSecret and extend the Helm Deployments and migration Job to use it.
5. Configure the identity provider's exact production callback URL and audience before enabling user traffic.
6. Configure GitHub repository secret `DOCKERHUB_USERNAME`. The CI workflow must have successfully published `platform-api:sha-<7-character-commit>` and `platform-web:sha-<7-character-commit>` for the selected main commit.
7. Create a GitHub Environment called `production`; configure reviewers and deployment branch restrictions.

### AWS EKS setup

Create an IAM role trusted by GitHub's OIDC provider. Restrict the role trust policy to this repository and the `production` GitHub Environment subject (for example, `repo:amitweb2012/kubernetes-cheatsheet:environment:production`). Grant only the permissions needed to describe the selected EKS cluster and obtain its connection details; Kubernetes RBAC inside the cluster must separately grant the deployment identity permissions to manage the Helm release and migration Job in the target namespace.

Add this GitHub repository secret:

- `AWS_ROLE_ARN`: ARN of the IAM role configured for GitHub OIDC.

The workflow uses the manually supplied AWS region and cluster name to run `aws eks update-kubeconfig`.

### Azure AKS setup

Configure a Microsoft Entra application/service principal with a federated identity credential trusting this GitHub repository's `production` Environment subject. Grant it the minimum Azure RBAC permissions to obtain AKS credentials. Configure Kubernetes RBAC/Azure RBAC to permit deployment operations in the target namespace.

Add these GitHub repository secrets:

- `AZURE_CLIENT_ID`: Entra application/client ID.
- `AZURE_TENANT_ID`: Entra tenant ID.
- `AZURE_SUBSCRIPTION_ID`: subscription ID (alternatively, provide it as the workflow input).

The workflow uses `azure/login` with OIDC and then `az aks get-credentials`.

### Run a deployment

1. Merge and validate the application changes on `main`. Wait for the CI workflow to finish and confirm the matching Docker image tags exist.
2. Open **GitHub → Actions → Deploy Platform API Stack → Run workflow**.
3. Select `aws` or `azure`.
4. Enter the cluster name and namespace. For AWS, enter the AWS region. For Azure, enter the resource group and optionally the subscription ID.
5. Select **Run workflow** and approve the protected `production` environment deployment if prompted.
6. Review the migration Job logs and Helm rollout result in the workflow run.
7. Verify the application using the production health endpoints and complete the OAuth login and note read/write smoke tests.

The workflow uses the same short SHA tag emitted by Docker Metadata Action (`sha-<7 characters>`), rather than deploying mutable `latest`. It runs `node src/db/migrate.js` in a one-off Job using the API image and the existing `platform-api-secrets` Secret before the Helm upgrade.

### Deployment safety notes

- The workflow is a deployment mechanism, not a complete production platform. Validate cluster access, network policy, ingress/TLS, storage, backups, monitoring and recovery before go-live.
- The migration Job must be able to pull the selected API image and reach PostgreSQL. A failed migration blocks the Helm upgrade.
- The workflow expects the namespace and Kubernetes Secrets to exist already; it does not create or populate secrets.
- The chart's bundled PostgreSQL and Redis resources are still the default example topology. Review the chart and values for your managed-service setup before deploying to production.
- The workflow uses `helm upgrade --install --atomic`; this rolls back Kubernetes resources on a failed Helm release, but it does not reverse a completed database migration. Use backward-compatible expand-and-contract migrations and maintain tested database backups.
- Restrict the GitHub Environment to trusted branches and require human approval. Never expose production deployment credentials to untrusted pull requests.
