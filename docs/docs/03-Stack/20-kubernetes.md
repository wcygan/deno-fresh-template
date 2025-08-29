---
sidebar_label: Kubernetes
---

# Kubernetes

Notes for deploying the Fresh app to Kubernetes.

## Overview

- Manifests live in `k8s/` (Namespace `app`, Deployment `fresh-app`, Service
  `fresh-app`).
- Skaffold config at repo root `skaffold.yaml` builds `frontend/Dockerfile` and
  deploys `k8s/*.yaml`.
- Local dev defaults to `push: false` and port-forwards Service `80 → 8080`.

See: `k8s/AGENTS.md` for full notes and Skaffold details.

## Quick start (Skaffold)

```bash
# Deploy app
deno task k8s:deploy

# Cleanup
deno task k8s:delete
```

Open the app at `http://localhost:8080` (or run `deno task open-local-app`).

## Checking the Kubernetes Resources

```bash
kubectl get deploy -n app

NAME        READY   UP-TO-DATE   AVAILABLE   AGE
fresh-app   3/3     3            3           7m50s
```

```bash
kubectl get pods -n app

NAME                         READY   STATUS    RESTARTS   AGE
fresh-app-6d4d9696c5-2lrdw   1/1     Running   0          7m22s
fresh-app-6d4d9696c5-cg2gt   1/1     Running   0          7m22s
fresh-app-6d4d9696c5-vvqp2   1/1     Running   0          7m22s
```

```bash
kubectl get svc -n app

NAME        TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
fresh-app   ClusterIP   10.43.240.36   <none>        80/TCP    7m37s
```

