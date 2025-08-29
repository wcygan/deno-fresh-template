# Getting Started

You can get the application running in a variety of ways:

## Prerequisites

Install the following tools:

1. [Deno](https://docs.deno.com/runtime/getting_started/installation/)
2. [Docker](https://docs.docker.com/get-docker/) 
3. [kubectl](https://kubernetes.io/docs/tasks/tools/)
4. [Skaffold](https://skaffold.dev/docs/install/)

If deploying to Kubernetes, you will also need a cluster. See e.g. [k3d](https://k3d.io/),
[minikube](https://minikube.sigs.k8s.io/docs/),
[kind](https://kind.sigs.k8s.io/), [Talos](https://www.talos.dev/).

## Local

Run it on your computer:

```bash
deno task dev
deno task open-local-app
```

## Docker

Run it on your computer in a Docker container:

```bash
deno task docker:build
deno task docker:run
deno task open-local-app
```

## Kubernetes

Run it in your Kubernetes cluster:

```bash
deno task k8s:deploy
deno task k8s:forward
deno task open-local-app
```
