---
sidebar_label: Deno Fresh
---

# Deno Fresh

Notes for working with the Fresh 2.x app in this repo.

## Overview

- App lives in `frontend/` and uses JSR imports (no Node needed for the app).
- `main.ts` builds the `App`, mounts middleware, and registers file routes via
  `app.fsRoutes()`.
- Prefer file routes for simple pages; use programmatic routes for composition.

## Common commands

Run from repo root (tasks `cd` into `frontend/` where needed):

```bash
# Dev server (HMR)
deno task dev

# Build production bundle
deno task build

# Serve built app
deno task start

# Tests, lint, typecheck (CI parity)
deno task ci:all
```

App opens on `http://localhost:8080` when using `deno task open-local-app`.

## Project layout (frontend/)

- `main.ts`: constructs the Fresh `App` and exports `app` for tests.
- `routes/`: file routes (`index.tsx`, nested, `_middleware.ts`).
- `islands/`: client-hydrated components (serializable props only).
- `components/`: server/shared Preact components.
- `static/`: static assets (served by `staticFiles()`).
- `utils.ts`: `createDefine<State>()` helpers and shared `State` type.

## Testing

- Integration tests via `app.handler()`; 
- see examples in`frontend/AGENTS.md`.
- Typical run: `deno task test`.

## Tips

- Keep islands small; push logic server-side when possible.
- Pin JSR versions exactly; keep `deno.lock` up to date.
