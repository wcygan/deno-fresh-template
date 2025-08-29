---
sidebar_position: 1
slug: /
---

# Introduction

Get started with [Deno Fresh](https://fresh.deno.dev/).

This template comes with:

1. A working [Deno Fresh](https://fresh.deno.dev/) application
2. [Docker build](https://docs.deno.com/runtime/reference/docker/) and
   [push to Github Container Registry](https://github.com/wcygan/deno-fresh-template/blob/main/.github/workflows/build-and-push-to-ghcr.yml)
3. [Kubernetes](https://kubernetes.io/) Deploy
4. Documentation with [Docusaurus](https://docusaurus.io/) (and
   [Mermaid support](https://docusaurus.io/docs/next/markdown-features/diagrams))
   and
   [GitHub Pages Deployment](https://github.com/wcygan/deno-fresh-template/blob/main/.github/workflows/deploy-github-pages.yml)

## Docker Build & Push to GitHub Container Registry

> [See the Images pushed to Github Container Registry](https://github.com/wcygan/deno-fresh-template/pkgs/container/deno-fresh-template%2Ffrontend)

The following sequence shows a push to `main` triggering a build and push to
GHCR.

```mermaid
sequenceDiagram
  autonumber
  participant Dev as Developer
  participant GH as GitHub Repo
  participant CI as GitHub Actions
  participant DK as Docker Engine
  participant REG as GHCR (Registry)

  Dev->>GH: Push to main
  GH-->>CI: Trigger workflow
  CI->>CI: Checkout repo
  CI->>CI: Setup Deno / cache deps
  CI->>DK: Build container image
  DK-->>CI: Image built
  CI->>REG: Push tags (:latest, :sha)
  REG-->>CI: 201 Created
  CI-->>GH: Commit status: success
  Note over CI,REG: Image is now available for deploys
```

## Kubernetes Deploy

We can deploy
[the container](https://github.com/wcygan/deno-fresh-template/pkgs/container/deno-fresh-template%2Ffrontend)
into a Kubernetes cluster.

For example, we can use a `Service` that targets a `Deployment` managing 3 Pods
inside the cluster:

```mermaid
%%{init: { 'theme': 'neutral' }}%%
flowchart LR
  subgraph "Kubernetes Cluster"
    subgraph "Namespace: app"
      S[(Service<br>ClusterIP)]
      D[[Deployment<br>fresh-app]]
      P1[(Pod 1)]
      P2[(Pod 2)]
      P3[(Pod 3)]
    end
  end

  S --> D
  D --> P1
  D --> P2
  D --> P3

  classDef svc fill:#ecfeff,stroke:#06b6d4,stroke-width:2px,color:#0e7490;
  classDef dep fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#4338ca;
  classDef pod fill:#f0fdf4,stroke:#22c55e,color:#166534;
  class S svc;
  class D dep;
  class P1,P2,P3 pod;
```
