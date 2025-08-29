---
sidebar_label: Kubernetes
---

# Kubernetes

Notes for deploying the Fresh app to Kubernetes. Uses Skaffold for a
smooth local dev loop.

## Overview

- Manifests live in `k8s/` (Namespace `app`, Deployment `fresh-app`, Service
  `fresh-app`).
- Skaffold config at repo root `skaffold.yaml` builds `frontend/Dockerfile` and
  deploys `k8s/*.yaml`.
- Local dev defaults to `push: false` and port-forwards Service `80 → 8080`.

See: `k8s/AGENTS.md` for full notes and Skaffold details.

## Quick start (Skaffold)

```bash
# Rebuild on change, redeploy, and port-forward to localhost:8080
skaffold dev

# One-off build & deploy
deno task k8s:deploy

# Cleanup
deno task k8s:delete
```

Open the app at `http://localhost:8080` (or run `deno task open-local-app`).

## Manual apply

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl -n app get all
kubectl -n app port-forward svc/fresh-app 8080:80  # optional
```

## Notes

- Images are version-pinned; keep tags exact and avoid `latest`.
- For remote clusters/registries, configure Skaffold to push and adjust tags,
  or build/push externally and reference the pushed tag in manifests.
