# Platform API Stack — Kubernetes Portfolio Project

A production-minded learning project demonstrating an API edge, Kubernetes ingress, a stateless Node.js API, Redis caching, PostgreSQL persistence, Helm packaging, and Kubernetes security controls.

> **Learning architecture:** Client → Kong API Gateway → NGINX Ingress → Kubernetes Service → API Deployment/Pods → Redis + PostgreSQL.

## Architecture

```mermaid
flowchart TB
  Client["Client / curl"] --> Kong["Kong API Gateway<br/>TLS, authentication, rate limits"]
  Kong --> Ingress["NGINX Ingress Controller<br/>host/path routing"]
  Ingress --> ApiSvc["platform-api Service<br/>ClusterIP :3000"]
  ApiSvc --> ApiPods["API Deployment<br/>2+ stateless Pods"]
  ApiPods --> RedisSvc["Redis Service"]
  RedisSvc --> Redis["Redis Pod<br/>cache"]
  ApiPods --> DbSvc["PostgreSQL Service"]
  DbSvc --> Pg["PostgreSQL StatefulSet"]
  Pg --> PVC["PersistentVolumeClaim"]
  PVC --> Disk["StorageClass / CSI volume"]
  subgraph Cluster["Kubernetes Cluster"]
    Ingress
    ApiSvc
    ApiPods
    RedisSvc
    Redis
    DbSvc
    Pg
    PVC
  end
```

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
| API Deployment | Runs stateless Express API replicas |
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
  --from-literal=REDIS_URL='redis://platform-api-stack-redis:6379'
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
