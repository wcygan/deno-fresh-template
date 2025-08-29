---
sidebar_label: Docker
---

# Docker

Notes for building and running the Fresh app in Docker.

## Overview

- Multi-stage Dockerfile at `frontend/Dockerfile`.
- Exposes app on container port `8000`; our runtime maps `80 → 8000` in
  Kubernetes and `8080:80` locally for convenience.
- Image is suitable for Kubernetes via Skaffold (see the Kubernetes page).


## Quick start

From repo root:

```bash
# Build image (tags locally as `fresh-app`)
deno task docker:build

# Run container (http://localhost:8080)
deno task docker:run
deno task open-local-app
```

## Build with custom tag

```bash
cd frontend
# Example: build with GHCR tag
docker build . -t ghcr.io/wcygan/deno-fresh-template/frontend:local
```

## Notes

- The Dockerfile caches Deno deps, builds the app, and runs `deno task start`.
- If you change dependency pins, rebuild with `--no-cache` to refresh layers.
- For CI-based builds and pushes to GHCR, see the workflow in the repo and the
  intro doc’s registry section.
