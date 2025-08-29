---
sidebar_label: Telepresence
---

# Telepresence

Notes on remote dev using Telepresence, matching our `deno.json` tasks and `scripts/setup_telepresence.ts` behavior. This page walks through the full workflow from zero to productive remote development.

## Overview

- Purpose: route Kubernetes `Service/fresh-app` traffic to your local dev server for fast iteration without container rebuilds.
- Version pinning: client defaults to `v2.24.0` (override via `TELEPRESENCE_VERSION`). Uses system Telepresence only if it matches the pin; otherwise downloads to `.bin/telepresence`.
- Traffic manager: installs/validates Telepresence traffic manager in namespace `ambassador` (change via `--manager-namespace`).
- Target: intercepts `Service/fresh-app` in namespace `app`, mapping cluster port `http` to local port `8000`.

The orchestration lives in `scripts/setup_telepresence.ts` and all tasks print a JSON summary for quick diagnostics.

## Prerequisites

- Deno ≥ 2.0
- `kubectl` configured against your cluster with permissions to install the traffic manager in `ambassador`.
- App deployed to the cluster so the `Service/fresh-app` exists in namespace `app`.
  - Deploy: `deno task k8s:deploy`
- Local dev server listening on port `8000` (changeable):
  - `cd frontend && deno task dev`

## Tasks (deno.json)

- `tp:setup`: installs/validates the pinned client and traffic manager.
  - `deno task tp:setup`
- `tp:connect`: connects the client to the cluster (scoped by namespace when intercepting).
  - `deno task tp:connect`
- `tp:intercept`: connects and intercepts `fresh-app` in `app`, mapping local `8000 → Service port http`.
  - `deno task tp:intercept`
- `tp:leave`: removes the `fresh-app` intercept if present.
  - `deno task tp:leave`
- `tp:quit`: shuts down Telepresence daemons (resets state; useful after cluster changes).
  - `deno task tp:quit`
- `tp:status`: prints Telepresence status as JSON (daemons, connection, namespace, etc.).
  - `deno task tp:status`

All tasks run with the required `--allow-*` permissions and print a JSON summary (client, manager, connect/intercept/leave/quit results).

## Full workflow (from scratch)

1) Deploy app resources to the cluster (creates `Service/fresh-app` in `app`):

```bash
deno task k8s:deploy
```

2) Start your local dev server on port 8000:

```bash
cd frontend && deno task dev
```

3) Prepare Telepresence (one-time per machine/cluster):

```bash
deno task tp:setup
```

4) Connect and intercept the service so cluster traffic reaches your local dev:

```bash
deno task tp:intercept
```

This will:
- Ensure the traffic manager is installed and ready.
- Connect to the cluster and scope to namespace `app`.
- Create an intercept for `fresh-app` mapping cluster `http` → local `8000`.

5) Verify traffic reaches your local server:

- Port-forward and browse locally:

```bash
deno task k8s:forward
open http://localhost:8080/
```

- Or, from within the cluster (e.g., a debug pod), curl the `fresh-app` Service. Responses should come from your local server while the intercept is ACTIVE.

6) Iterate on code locally. The intercept steers requests to your dev server instantly.

7) When done, stop interception and/or reset daemons:

- Remove intercept only:

```bash
deno task tp:leave
```

- Quit daemons (useful after kube-context/cluster changes):

```bash
deno task tp:quit
```

8) Inspect Telepresence state at any time:

```bash
deno task tp:status
```
This prints a JSON snapshot of user/root daemons and traffic-manager info (when connected).

## Customization

- Version: set `TELEPRESENCE_VERSION` in your environment (e.g., `v2.24.0`) to override the default pin.
- Manager namespace: pass `--manager-namespace <ns>` to the script if you need a different install target.
- Service/namespace/port: the `tp:intercept` task uses `--service fresh-app --service-namespace app --port 8000`. Adjust if your Service name/namespace/ports differ.
- Named port: the script maps `${LOCAL_PORT}:http` where `http` is the named Service port in `k8s/service.yaml`. Update if you change the Service port name.

## Behavior details

- Binary selection: prefers system `telepresence` if it matches the pinned version; otherwise downloads the pinned release for your OS/arch to `.bin/telepresence` and makes it executable.
- Traffic manager: installs via `telepresence helm install --namespace ambassador` and polls until ready.
- Namespace scoping: Telepresence v2.24.0 does not support `--namespace` on `intercept`. The script passes `--namespace app` to `telepresence connect`, and `intercept` uses that scope.
- Unsupported flags: v2.24.0 does not support `--preview-url` or `--http-header` on `intercept`; the script ignores these if provided.

## Troubleshooting

- Connect requires elevated privileges on some systems; if `connect` fails due to permissions, re-run with appropriate privileges.
- Ensure your current kube context can create resources in the manager namespace and that `Service/fresh-app` exists in `app`.
- Conflicting intercept: if an intercept already exists, the script treats it as OK. Use `deno task tp:leave` to remove it.
- Verify local server: confirm your local dev listens on the port you intercept (`8000` by default). Update the `--port` if you change `PORT`.

## Cleanup

- Remove intercept: `deno task tp:leave`
- End the session: `deno task tp:quit`
- Remove manager (optional): uninstall via Helm via Telepresence: `telepresence helm uninstall --namespace ambassador`
