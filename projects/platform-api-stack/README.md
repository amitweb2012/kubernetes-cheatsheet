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
```

For Minikube, build directly into its Docker environment or load the image:

```bash
minikube image load platform-api:1.0.0
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

Configure a confidential Keycloak client (or compatible OIDC provider) with:
- Client ID: `platform-notes` (or your chosen ID)
- Client authentication: enabled
- Standard authorization code flow: enabled
- Valid redirect URI: `https://app.platform.local/api/auth/callback/keycloak`
- Web origin: `https://app.platform.local`
- PKCE: S256
- An access-token audience mapper that includes the client ID as `platform-notes` (or set `OIDC_AUDIENCE` to the audience emitted by your provider)

Set `OIDC_ISSUER` to the realm issuer URL (for Keycloak, for example `https://identity.example.com/realms/platform`). The API Secret needs `OIDC_ISSUER` and `OIDC_AUDIENCE`; the web Secret needs `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`. The chart injects `API_INTERNAL_URL` for server-to-server calls. Never expose the client secret or NextAuth secret to browser-side variables.

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
kubectl run platform-db-migrate -n platform --rm -it --restart=Never \\
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
curl http://localhost:3000/api/v1/notes
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
