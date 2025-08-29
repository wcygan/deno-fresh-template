# Middleware Guide

Canonical guidance for Fresh 2.x middleware in this repo. Explains how the
stack is composed and how configuration is sourced from `frontend/env.ts`.

## Where Things Live

- `middleware/index.ts`: exports individual middleware and a stack composer.
- `main.ts`: mounts the composed middleware (order matters) and any scoped ones.
- `utils.ts`: defines the shared `State` type used by middleware.
- `env.ts`: validated env and structured app config used by some middleware.

## Middleware Shape & Typing

- Function signature: `(ctx) => Response | Promise<Response>`.
- Use `define.middleware(...)` for helpers that need shared `State` typing.
- Per-request data goes on `ctx.state` (typed by `State` from `utils.ts`).
- Prefer folder-scoped file middlewares for route subtrees (`routes/**/_middleware.ts`).

```ts
// utils.ts
export interface State {
  shared: string;
  requestId: string;
  start: number;
}
```

## What We Provide

`middleware/index.ts` exposes reusable middleware and a config-driven stack:

- `requestId`: assigns `ctx.state.requestId` and adds `X-Request-ID` header.
- `timing`: measures duration, sets `Server-Timing` and `X-Response-Time`; if
  OpenTelemetry is active, also sets `X-Trace-Id`/`X-Span-Id` from the active span.
- `security(options = config.security)`: sets common security headers and
  conditional CSP for HTML responses.
- `rateLimit(options = config.security)`: simple token bucket keyed by
  `ip:path`. Obeys `enableRateLimit`, `rateLimitMax`, `rateLimitWindowMs`.
- `errorHandler`: converts unhandled exceptions to RFC 7807 JSON problems and
  logs a compact line.
- `logging`: structured access log including duration and `requestId`.
- `cors(options)`: minimal CORS support for APIs, including preflight handling.

## Composing The Stack

Use `createMiddlewareStack` to build the default stack, optionally including or
excluding pieces and appending custom middlewares.

```ts
// main.ts
import { createMiddlewareStack, middlewares } from "./middleware/index.ts";
import { define } from "./utils.ts";

for (const mw of createMiddlewareStack({
  // Default order: requestId → timing → errorHandler → security → logging
  // include: ["requestId", "timing", ...] // to override order
  // exclude: ["logging"] // to drop one
  custom: [
    define.middleware(async (ctx) => {
      ctx.state.shared = "hello";
      return await ctx.next();
    }),
  ],
})) {
  app.use(mw);
}

// Scoped to a path prefix
app.use("/api", middlewares.rateLimit());
```

Rules:

- Mount global middlewares before routes (`app.fsRoutes()` and programmatic routes).
- Use path scoping (`app.use("/api", ...)`) to limit impact.
- Add folder-scoped `_middleware.ts` under `routes/**/` for subtree concerns.

## Configuration Source: frontend/env.ts

`env.ts` centralizes configuration. It exports:

- `env`: direct, validated env vars (e.g., `PORT`, `LOG_LEVEL`, `OTEL_DENO`).
- `config`: structured app config assembled from env + defaults via Zod.

Relevant pieces used by middleware come from `config.security`:

- `enableCSP` (boolean, default `true`): if `true`, `security` middleware adds
  a conservative `Content-Security-Policy` header for HTML responses.
- `enableRateLimit` (boolean, default `true`): governs whether `rateLimit`
  checks tokens.
- `rateLimitMax` (number, default `60`): max requests per window per `ip:path`.
- `rateLimitWindowMs` (number, default `60000`): window size in ms.

The values above are built by `loadConfig()` from environment variables with
exact names:

- `ENABLE_CSP` → `enableCSP` ("true"/"false")
- `ENABLE_RATE_LIMIT` → `enableRateLimit` ("true"/"false")
- `RATE_LIMIT_MAX` → `rateLimitMax` (number)
- `RATE_LIMIT_WINDOW_MS` → `rateLimitWindowMs` (number)
- `OTEL_DENO` → `observability.enableOtel` ("true"/"false"); influences tracing
  headers when an active span exists.

Example overrides at runtime:

```bash
ENABLE_CSP=false ENABLE_RATE_LIMIT=true RATE_LIMIT_MAX=120 RATE_LIMIT_WINDOW_MS=30000 deno task dev
```

Notes:

- `env.ts` reads `Deno.env` and should not be imported by islands. Keep it on
  the server.
- All config is validated via Zod. Invalid values throw early.

## Adding New Middleware

1) Implement it in `middleware/index.ts` and add to the `middlewares` map.

```ts
export const middlewares = {
  // ...existing
  myHeader: () => async (ctx) => {
    const res = await ctx.next();
    res.headers.set("X-My-Header", "1");
    return res;
  },
};
```

2) Include it by name via `createMiddlewareStack({ include: [ ... ] })`, or add
   it as a `custom` entry in `main.ts`.

3) If it needs configuration, extend `AppConfigSchema` in `env.ts` and plumb a
   typed options object similar to `security`.

## Testing Middleware

- Prefer integration tests using the app handler (`app.handler()`).
- Assert headers/status around `await ctx.next()` effects.

```ts
// tests/integration_test.ts (excerpt)
import { app } from "../main.ts";
import { assertEquals } from "jsr:@std/assert";

Deno.test("middleware stack sets headers", async () => {
  const res = await app.handler()(new Request("http://x/healthz"));
  const id = res.headers.get("x-request-id");
  assertEquals(typeof id, "string");
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
});
```

## Do/Don’t

- Do mount global middlewares before routes; order is significant.
- Do keep per-request data in `ctx.state`; avoid module-level mutation.
- Do scope middlewares to prefixes or route folders for least privilege.
- Don’t import `env.ts` from client code; it reads process env.
- Don’t widen the `State` shape casually; update `utils.ts` and review usages.

