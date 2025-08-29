## Kubernetes & Skaffold (frontend)

> Quick, minimal notes for agents deploying the Fresh frontend with Kubernetes
> and Skaffold. Mirrors the structure shown in `docs/docs/intro.md` and uses the
> `app` namespace.

### Prereqs

- `kubectl` connected to a cluster
- `skaffold` v2+ (Skaffold v4 config used here)
- Docker daemon available for local builds

### Manifests (in this folder)

- `namespace.yaml`: Creates `Namespace app`.
- `deployment.yaml`: `Deployment fresh-app`
  - Replicas: `3`
  - Image: `ghcr.io/wcygan/deno-fresh-template/frontend:main`
  - Container: exposes `containerPort: 8000`
  - Resources: `limits { cpu: 100m, memory: 128Mi }`
- `service.yaml`: `Service fresh-app` (ClusterIP)
  - Port: `80` → `targetPort: 8000`

#### Apply manually with kubectl

```
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl -n app get all
# Optional local port-forward
kubectl -n app port-forward svc/fresh-app 8080:80
```

### Skaffold (root: `skaffold.yaml`)

- Builds `frontend` image from `./frontend/Dockerfile`.
- Local build with `push: false` (good for minikube/kind/microk8s).
- Deploys raw YAML from `k8s/` in order (namespace first).
- Port-forwards `Service/fresh-app` (80) to `localhost:8080`.

```
# Dev loop: rebuild on change, redeploy, port-forward
skaffold dev

# One-off build & deploy
skaffold run

# Cleanup
skaffold delete
```

#### Notes

- Skaffold rewrites image references in manifests to the built tag for the
  artifact `ghcr.io/wcygan/deno-fresh-template/frontend`. No registry push is
  required when `push: false` and running against a local cluster.
- If you need to push to a remote cluster/registry, set `build.local.push: true`
  or use a profile that pushes and adjusts image tags accordingly.

### Where things live

- Kubernetes: `k8s/namespace.yaml`, `k8s/deployment.yaml`, `k8s/service.yaml`
- Skaffold: `skaffold.yaml` (at repo root)
- App image: `ghcr.io/wcygan/deno-fresh-template/frontend` (built from
  `/frontend`)
