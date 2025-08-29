# Repository Guidelines

Concise contributor guide for this Deno Fresh 2.x repository. Prefer JSR imports
and standard web APIs; no Node tooling is required for the app.

Middleware docs: see `frontend/middleware/AGENTS.md` for how the middleware
stack is composed and how it loads configuration from `frontend/env.ts`.

## Project Structure & Module Organization

- `main.ts`: builds the `App`, registers global middleware, calls
  `app.fsRoutes()`.
- `routes/`: file-based routes (`index.tsx`, nested folders, `_middleware.ts`).
- `islands/`: interactive, client-hydrated components.
- `components/`: server-only/shared Preact components.
- `static/`: static assets (images, CSS). Served via `staticFiles()`.
- `utils.ts`: `createDefine()` helpers and the shared `State` interface.
- `dev.ts`: dev/build entry (e.g., Tailwind plugin wiring) if present.
- `env.ts`: validated environment + runtime config (server-only).
- `middleware/AGENTS.md`: middleware composition, ordering, and config sources.
- `*_test.ts`/`*_test.tsx`: tests near code.

## Build, Test, and Development Commands

- Dev: `deno task dev` — start the local dev server with HMR.
- Build: `deno task build` — produce the production bundle.
- Start: `deno task start` — serve the built app.
- Lint/Format/Typecheck: `deno fmt && deno lint && deno check`.
- Tests: `deno test -A` — run unit/integration tests.

## Coding Style & Naming Conventions

- TypeScript, 2-space indentation, semicolons optional (follow formatter).
- Imports: use JSR (e.g., `jsr:@fresh/core`) and standard URLs; avoid Node libs.
- Components: `PascalCase` for Preact components; routes mirror URL paths (e.g.,
  `routes/blog/[slug].tsx`).
- Define helpers: import from `utils.ts` (`define.page`, `define.handlers`,
  `define.middleware`). Keep `State` centralized and minimal.

## Testing

Goals: fast, deterministic feedback using Deno’s built-in test runner; emphasize
Fresh-style request/response tests over DOM-heavy approaches.

### Structure & Naming

- Co-locate unit tests with code for discoverability:
  - `components/Button_test.tsx`, `utils/format_test.ts`.
  - Islands: only test logic that doesn’t require the browser DOM (signals,
    reducers).
- Keep integration/black-box tests in `tests/` at the frontend root:
  - `tests/app_test.ts`, `tests/routes_test.ts`, `tests/middleware_test.ts`.
- Filenames: `*_test.ts` / `*_test.tsx` (Deno finds recursively). Snapshots live
  next to tests in `__snapshots__/`.

Tip: run from this folder: `cd frontend && deno test`.

### Integration tests (preferred)

Use the programmatic handler from `main.ts`.

```ts
// tests/app_test.ts
import { app } from "./main.ts";
import { assert, assertEquals } from "jsr:@std/assert";

Deno.test("/ returns HTML", async () => {
  const res = await app.handler()(new Request("http://x/"));
  assertEquals(res.status, 200);
  assert(res.headers.get("content-type")?.includes("text/html"));
});

Deno.test("/api2/:name capitalizes", async () => {
  const res = await app.handler()(new Request("http://x/api2/jessie"));
  assertEquals(await res.text(), "Hello, Jessie!");
});
```

For folder-scoped middleware in `routes/**/_middleware.ts`, hit any route within
that subtree and assert headers/status/redirects.

### Unit tests (targeted)

- Pure helpers (formatters/validators):

```ts
// utils/format_test.ts
import { assertEquals } from "jsr:@std/assert";
import { formatPrice } from "./format.ts";
Deno.test("formatPrice", () => {
  assertEquals(formatPrice(1234.5), "$1,234.50");
});
```

- Islands logic without DOM (use signals/functions, not browser APIs):

```ts
// islands/Counter_logic_test.ts
import { signal } from "@preact/signals";
import { assertEquals } from "jsr:@std/assert";
Deno.test("counter increments", () => {
  const n = signal(0);
  n.value++;
  assertEquals(n.value, 1);
});
```

### Mocks, stubs, spies

Use `jsr:@std/testing/mock`; prefer `using` to auto-restore.

```ts
import { FakeTime, spy, stub } from "jsr:@std/testing/mock";
import { assertEquals } from "jsr:@std/assert";

Deno.test("stubs fetch", async () => {
  using s = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response("ok")),
  );
  // call code that uses fetch()
});

Deno.test("spies console.log", () => {
  using s = spy(console, "log");
  console.log("hello");
  assertEquals(s.calls.length, 1);
});

Deno.test("fake time", () => {
  using time = new FakeTime(1710000000000);
  // code that depends on Date.now()
});
```

### Snapshots (use sparingly)

Great for small, stable HTML fragments; avoid full-page snapshots.

```ts
import { assertSnapshot } from "jsr:@std/testing/snapshot";
Deno.test("hero fragment", async (t) => {
  const html = "<section>Hero</section>";
  await assertSnapshot(t, html);
});
// Update: deno test --allow-read --allow-write -- --update
```

### Permissions & Speed

- Default to no permissions.
  - Snapshots need `--allow-read --allow-write`.
  - If your tests perform network/file I/O, scope flags narrowly (e.g.,
    `--allow-net=localhost`, `--allow-read=./static`).
- Keep tests fast and deterministic; mock external boundaries and use
  `FakeTime`.

### Coverage

- Generate coverage locally:
  - `deno test --coverage=.cov`
  - `deno coverage .cov --lcov > coverage.lcov`

### Suggested tasks (optional)

Add to `frontend/deno.json` if helpful:

- `"test": "deno test"`
- `"test:watch": "deno test --watch"`
- `"coverage": "deno test --coverage=.cov && deno coverage .cov --lcov > coverage.lcov"`
- `"check": "deno fmt --check && deno lint && deno check"`

### E2E/browser tests (optional)

- If truly needed, keep in `e2e/` and run sparingly (they are slower/flakier).
- Follow Deno’s web testing guidance (WebDriver BiDi). Do not replace core
  integration tests with E2E.

## Commit & Pull Request Guidelines

- Commits: conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
  Keep diffs focused.
- PRs: include summary, rationale, linked issues, and instructions to verify.
  Add screenshots for UI changes.
- CI: ensure `deno fmt`, `deno lint`, typecheck, and tests pass locally before
  opening a PR.

## Security & Configuration Tips

- Read env/config only on the server via Deno APIs; never in islands.
- Do not store secrets in the repo. Use `.env`/runtime config and access in
  server code.
- Keep per-request data in `ctx.state` only; avoid global mutable singletons.

## Env & Runtime Config

- Purpose: `frontend/env.ts` centralizes validated environment and app config.
  It exports two things:
  - `env`: parsed environment variables (basic, e.g., `PORT`, `LOG_LEVEL`).
  - `config`: structured application config (security/observability, etc.).
- Server-only: never import from islands; this file reads `Deno.env`.
- Tests: pass `--allow-env` when a test depends on env/config.

### Usage

```ts
// dev.ts
import { env } from "./env.ts";
const port = Number(env.PORT);
```

```ts
// middleware/index.ts
import { config } from "../env.ts";
const { enableCSP, enableRateLimit } = config.security;
```

```ts
// main.ts (example of composing)
import { createMiddlewareStack } from "./middleware/index.ts";
for (const mw of createMiddlewareStack()) app.use(mw);
```

### Config shape (relevant keys)

- `env.PORT`: string port (default "8000").
- `env.LOG_LEVEL`: "debug" | "info" | "warn" | "error" (default "info").
- `env.OTEL_DENO`: "true" | "false" (default "true").
- `config.security.enableCSP`: boolean (default true).
- `config.security.enableRateLimit`: boolean (default true).
- `config.security.rateLimitMax`: number (default 60).
- `config.security.rateLimitWindowMs`: number (default 60000).

### Environment overrides

- Server
  - `PORT`, `HOST`, `LOG_LEVEL`
- Security
  - `ENABLE_CSP` ("true"|"false")
  - `ENABLE_RATE_LIMIT` ("true"|"false")
  - `RATE_LIMIT_MAX` (number)
  - `RATE_LIMIT_WINDOW_MS` (number, ms)
- Observability
  - `OTEL_DENO` ("true"|"false")
  - `OTEL_SERVICE_NAME` (string)

Defaults are applied via schema parsing; unset values fall back safely.

### Gotchas

- Do not import `env.ts` from client code or islands.
- Keep secrets in real environment; avoid committing `.env` files.
- When changing schema or keys, run `deno fmt && deno lint && deno check` and
  update any tests that rely on env.
