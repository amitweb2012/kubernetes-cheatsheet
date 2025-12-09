# Next.js 15 Microservices App with MongoDB, Kubernetes, Skaffold & CI/CD

This project is a full-stack example that uses:

- **Next.js 15 (App Router)** frontend
- **Node.js + Express** contact microservice
- **MongoDB** with **Persistent Volume Claim (PVC)** for data persistence
- **Kubernetes** manifests (Minikube friendly)
- **Skaffold** for hot reload in development
- **GitHub Actions** CI/CD to build & push Docker images

## Project structure

```text
next15-micro-k8s/
  next-app/                # Next.js 15 app (App Router)
  contact-service/         # Contact microservice (Express + MongoDB)
  k8s/                     # Kubernetes manifests
    namespace.yaml
    mongo.yaml
    contact-api.yaml
    frontend.yaml
  skaffold.yaml            # Skaffold dev config
  .github/workflows/
    ci-docker.yml          # GitHub Actions CI/CD
  .gitignore
  README.md
```

---

## 1. Next.js 15 app (App Router)

- Home page: `/` – simple landing page
- Contact page: `/contact` – form that posts to `/api/contacts`
- API route: `/api/contacts` – server-side route that proxies to the contact microservice.

The API route uses an environment variable:

- `CONTACT_API_URL` – URL of the contact microservice (inside K8s or local dev)

In Kubernetes, this is configured to use:

```text
http://contact-api-svc.nginx-test.svc.cluster.local:4000
```

---

## 2. Contact microservice (Express + Mongo)

Simple REST-ish microservice:

- `POST /contacts` – save contact details into MongoDB.

Uses environment:

- `PORT` – default `4000`
- `MONGO_URI` – Mongo connection string. In Kubernetes:

```text
mongodb://mongo-svc:27017/contacts
```

---

## 3. MongoDB with PV/PVC

`k8s/mongo.yaml` defines:

- A **PersistentVolumeClaim** (`mongo-pvc`)
- A MongoDB **Deployment** mounting `/data/db` from PVC
- A MongoDB **Service** (`mongo-svc`)

Data is persisted across Mongo pod restarts.

---

## 4. Kubernetes Manifests (Minikube-friendly)

- `namespace.yaml` – creates namespace `nginx-test`
- `mongo.yaml` – MongoDB with PVC
- `contact-api.yaml` – microservice + Service
- `frontend.yaml` – Next.js deployment + NodePort service

NodePort: **30080** (used mainly for direct browser access and debugging).  
Skaffold also port-forwards the frontend service to `localhost:3000`.

---

## 5. Skaffold dev workflow

`skaffold.yaml` is configured to:

- Build two images:
  - `next15-frontend`
  - `contact-service`
- Apply manifests in `k8s/`
- Port-forward `frontend-svc` to `http://localhost:3000`

### Run dev mode

```bash
# Start Minikube
minikube start --driver=docker

# From project root:
skaffold dev
```

Open:

- `http://localhost:3000` → Next.js home
- `http://localhost:3000/contact` → contact form

Submitting the form calls `/api/contacts` → contact microservice → MongoDB.

---

## 6. Docker images

There are two Dockerfiles:

- `next-app/Dockerfile` – builds and runs Next.js 15 app
- `contact-service/Dockerfile` – builds and runs the contact microservice

Skaffold uses these Dockerfiles to build images locally for Minikube.

---

## 7. GitHub Actions CI/CD

Workflow: `.github/workflows/ci-docker.yml`

What it does:

- Runs on pushes to `main`
- Checks out code
- Sets up Node 20
- Builds Next.js and microservice
- Builds and pushes two Docker images:
  - `${{ secrets.DOCKERHUB_USERNAME }}/next15-frontend`
  - `${{ secrets.DOCKERHUB_USERNAME }}/contact-service`

### Required GitHub secrets

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

- `DOCKERHUB_USERNAME` – your Docker Hub username
- `DOCKERHUB_TOKEN` – Docker Hub access token or password

After pushing to `main`, the workflow will automatically build & push images.

---

## 8. Basic usage

### 8.1 Local dev (without Kubernetes)

```bash
# Terminal 1: MongoDB (e.g. via Docker)
docker run -d --name mongo -p 27017:27017 mongo:6.0

# Terminal 2: contact-service
cd contact-service
npm install
MONGO_URI=mongodb://localhost:27017/contacts npm start

# Terminal 3: Next.js
cd next-app
npm install
CONTACT_API_URL=http://localhost:4000 npm run dev
```

Visit `http://localhost:3000`.

### 8.2 Run on minikube only

Build two Docker file on local

```
minikube service frontend-svc -n nginx-test
```

### 8.3 Dev on Minikube with Skaffold

```bash
minikube start --driver=docker

# From repo root
skaffold dev
```

Visit `http://localhost:3000`.
