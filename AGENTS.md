# AGENTS.md

> Canonical guidance for coding agents working on this Deno Fresh 2.x project.
> Optimized for the canary API (App, Middlewares, Context, Routing, Islands).
> Treat this as the source of truth over generic web advice.

---

## Where To Find Docs

- **Kubernetes**: See `k8s/AGENTS.md` for manifests layout, apply/verify
  workflows, Skaffold usage, and operational notes (HPA/PDB/Service/Deployment).
- **Docs/Docusaurus**: See `docs/AGENTS.md` for running the docs site, authoring
  conventions, navigation/sidebars, and deployment/CI details.
- **Frontend App**: See `frontend/AGENTS.md` for Fresh app structure, dev/build
  tasks, routing/middleware/islands patterns, and testing guidance.

## Quick start

**Prereqs**

- Deno ≥ 2.0
- No Node/npm required for the app itself. Prefer JSR imports (e.g.
  `jsr:@fresh/core`).

**Common commands**

- Dev: `deno task dev`
- Build: `deno task build`
- Start (serve built app): `deno task start`
- Typecheck & lint (if configured): `deno fmt && deno lint && deno check`

**Monorepo note**

- If the Fresh app lives in a subfolder (e.g. `frontend/`), run tasks from
  there. Example: `cd frontend && deno task dev`.

---

## Project conventions

- **Imports**: Use JSR (`jsr:@fresh/core`, `jsr:@fresh/plugin-tailwind`) and
  standard web APIs; avoid Node-specific modules.
- **Define helpers**: Centralize type-safe helpers via `createDefine` in a
  `utils.ts` and import `define.*` across routes, layouts, middleware.
- **State typing**: Keep a single `State` interface in `utils.ts`. Extend
  carefully; do not mutate shape in isolated files.
- **Directory layout** (typical):

  - `main.ts`: constructs the `App`, mounts middleware, registers file-system
    routes via `app.fsRoutes()`.
  - `routes/`: file-based routes (`index.tsx`, nested folders,
    `_middleware.ts`).
  - `islands/`: interactive components hydrated on the client.
  - `components/`: server-only or shared Preact components (non-hydrated).
  - `static/`: static assets (CSS, images). Served via `staticFiles()`
    middleware.
  - `utils.ts`: exports `define` and `State`.
  - `dev.ts`: builder/dev entry (e.g., Tailwind plugin wiring, build vs dev
    switch).
- **Styling**: If Tailwind is configured, prefer utility classes in JSX; avoid
  global CSS bloat.
- **Testing**: Use Deno test runner. For integration tests, produce a request
  `handler` from `App` and assert responses.
- **CI**: Ensure `deno fmt`, `deno lint`, typecheck, and tests pass before
  merge.

---

## Version pinning (no wildcards)

- **Docker images**: Pin to an exact Deno version. Example:
  `FROM denoland/deno:2.4.5` for both build and runtime stages.
- **No latest/ranges**: Avoid `latest`, caret (`^`), tilde (`~`), `*`, or version ranges everywhere.
- **JSR imports**: Use exact versions (e.g., `jsr:@fresh/core@2.0.0-alpha.63`).
- **NPM imports**: Use exact versions (e.g., `npm:preact@10.27.1`).
- **Lockfile**: Keep `deno.lock` committed and up to date; changes should be intentional.
- **Upgrades**: Bump versions explicitly, run `deno cache --reload` and tests, then commit the lockfile in the same PR.
- **Review checklist**: PRs should contain no `latest`, `^`, `~`, or version ranges in Dockerfiles or `deno.json` imports.

---

## Fresh 2.x (canary) core: how to contribute safely

### 1) App (programmatic routes & composition)

`main.ts` builds the single `App` instance. Important rules:

- **Order matters**. `.use()` and route registrations are applied top-to-bottom.
  Middlewares defined after a route don’t affect that route.
- Prefer **file routes** for normal pages and **programmatic routes** when
  dynamic composition, nesting, or conditional mounting is required.
- Always call `app.fsRoutes()` once to inject file-system routes (optionally at
  a mount path).
- For testability, you may create `const handler = app.handler()`; keep
  `app.listen()` only in the runtime entry path.

**Skeleton**

```ts
// main.ts (illustrative)
import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";

export const app = new App<State>();
app.use(staticFiles());
app.use((ctx) => {
  ctx.state.requestId = crypto.randomUUID();
  return ctx.next();
});
app.get("/health", () => new Response("ok"));
app.fsRoutes();

// Only in actual server entry:
app.listen({ port: 8000 });
```

**When adding new top-level functionality**

- Place global middleware **before** related routes.
- If composing sub-apps, use a dedicated mount path (e.g.,
  `app.mountApp("/admin", adminApp)`), keeping concerns isolated.

### 2) Middlewares (cross-cutting concerns)

- A middleware is `(ctx) => Response | Promise<Response>` and can:

  - mutate `ctx.state` for downstream handlers,
  - inspect/modify `ctx.req` and `ctx.url`,
  - wrap `await ctx.next()` to post-process the response.
- Prefer `define.middleware()` to inherit the shared `State` type.
- Scope middlewares by path: `app.use("/api", authMiddleware)`.
- Filesystem middlewares live in `routes/**/_middleware.ts` and apply to that
  folder subtree.

**Patterns**

```ts
// utils.ts
import { createDefine } from "fresh";
export interface State {
  requestId?: string;
  user?: { id: string };
}
export const define = createDefine<State>();

// routes/_middleware.ts (folder-scoped)
export default define.middleware(async (ctx) => {
  const res = await ctx.next();
  res.headers.set("server", "fresh");
  return res;
});

// main.ts (global)
app.use(define.middleware((ctx) => {
  /* auth/session */ return ctx.next();
}));
```

**Don’ts**

- Don’t register a middleware after the routes it must affect.
- Don’t store request-specific data in module-level variables; use `ctx.state`.

### 3) Context (the per-request API surface)

Use `ctx` to:

- Access **config** (`ctx.config`), **URL** (`ctx.url`), **Request**
  (`ctx.req`).
- Read matched **route pattern** (`ctx.route`) and **params** (`ctx.params`).
- Pass data via **state** (`ctx.state`), which is typed by `State`.
- **Redirect** (`ctx.redirect("/path", 307)`) and **render** JSX
  (`ctx.render(<h1/> , { status, headers })`).

**Guidelines**

- Only place serializable data in `state` that downstream consumers need.
- Favor `ctx.render()` for HTML responses; use `new Response()` for
  raw/text/JSON APIs.

### 4) Routing (URLPattern-powered)

- Register programmatic routes with `.get/.post/.put/.delete/.head/.all`.
- Dynamic segments: `"/books/:id"` → `ctx.params.id`.
- Wildcards: `"/files/*"` → capture remainder in `ctx.params[0]`.
- File routing remains first-class: place `routes/foo/bar.tsx` → `/foo/bar`.
- Prefer file routes for simple pages; programmatic routes for conditional
  composition, or when sharing stacked middleware arrays.

**Examples**

```ts
app
  .get("/", (ctx) => ctx.render(<Home />))
  .get("/api/ping", () => Response.json({ ok: true }))
  .post("/api/items", createItem)
  .get("/blog/:slug", (ctx) => new Response(ctx.params.slug));
```

### 5) Islands (client interactivity)

- Place interactive components in `islands/` (or `(_islands)` under a route
  folder).
- **Props must be serializable**. Functions are not supported as props.
- You can pass server-rendered **JSX as props**; Fresh serializes and
  rehydrates.
- Use `IS_BROWSER` guard for client-only APIs (e.g., `navigator.getUserMedia`).
- Prefer small, targeted islands to keep client JS minimal.

**Patterns**

```tsx
// islands/Counter.tsx
import { useSignal } from "@preact/signals";
export default function Counter() {
  const n = useSignal(0);
  return <button onClick={() => n.value++}>Count: {n}</button>;
}

// routes/index.tsx
import Counter from "../islands/Counter.tsx";
export default define.page(() => (
  <main>
    <h1>Welcome</h1>
    <Counter />
  </main>
));
```

---

## File routes: handlers + pages (type-safe via define helpers)

Use `define.handlers()` to declare HTTP handlers alongside a `define.page()`
default export. Page props can be inferred from the handler output for
end-to-end type safety.

```tsx
// routes/example.tsx
export const handler = define.handlers({
  GET(ctx) {
    return { data: { message: "Hello" } };
  },
});

export default define.page<typeof handler>((props) => (
  <div>{props.data.message}</div>
));
```

**Rules**

- Keep handler return values small & serializable.
- Prefer `props.data` for page data (instead of global state).

---

## Testing strategy (Deno test)

- Prefer integration-style request/response tests over DOM-heavy component
  tests.
- Export `app` from `main.ts`; only call `app.listen()` in the runtime entry
  (e.g., `dev.ts`). Tests call `app.handler()` directly.
- Co-locate small unit tests near code and keep higher-level tests in a `tests/`
  folder.

**Layout & discovery**

- Co-located unit tests: `components/Button_test.tsx`,
  `islands/Counter_test.tsx` (logic-only), `utils/format_test.ts`.
- Integration tests: `tests/app_test.ts`, `tests/routes_test.ts`,
  `tests/middleware_test.ts`.
- Naming: `*_test.ts` / `*_test.tsx` (auto-discovered recursively). Benchmarks:
  `*_bench.ts`.
- Snapshots live alongside tests under `__snapshots__/` (managed by
  `@std/testing/snapshot`).

**Integration tests (preferred)**

```ts
// tests/app_test.ts
import { app } from "./main.ts";
import { assert, assertEquals } from "jsr:@std/assert";

Deno.test("/health returns ok", async () => {
  const res = await app.handler()(new Request("http://x/health"));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("index renders HTML", async () => {
  const res = await app.handler()(new Request("http://x/"));
  assertEquals(res.headers.get("content-type")?.includes("text/html"), true);
  const html = await res.text();
  assert(html.includes("<h1") || html.includes("<main"));
});
```

**Middleware tests**

- Assert headers/status/redirects around `await ctx.next()` using
  request/response tests or folder `_middleware.ts` routes.

**Unit tests (when valuable)**

- Pure helpers (formatters/validators) and small island logic (signals/reducers)
  that don’t require a browser DOM.
- Prefer testing island logic as functions or via signals, guarded behind
  `IS_BROWSER` where necessary.

**Mocks, stubs, spies**

- Use `jsr:@std/testing/mock` utilities.

```ts
import { spy, stub } from "jsr:@std/testing/mock";

Deno.test("fetch is called once", async () => {
  using s = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response("ok")),
  );
  // call code that uses fetch()
});
```

- Use `FakeTime` for time-dependent code; prefer `using` to auto-restore.

**Snapshots (sparingly)**

- Use for small, stable HTML/string fragments. Avoid brittle full-page
  snapshots.

```ts
import { assertSnapshot } from "jsr:@std/testing/snapshot";
Deno.test("hero fragment", async (t) => {
  const html = "<section>Hero</section>";
  await assertSnapshot(t, html);
});
// Update snapshots: deno test --allow-read --allow-write -- --update
```

**Permissions & speed**

- Start with zero permissions; add narrowly as needed:
  - Snapshots: `--allow-read --allow-write` (to manage snapshot files).
  - If tests perform network/file I/O, scope flags: `--allow-net=localhost` or
    `--allow-read=./static`.
- Keep tests fast and deterministic; stub external calls and use `FakeTime`.

**Coverage**

- Typical flow:
  - `deno test --coverage=.cov`
  - `deno coverage .cov --lcov > coverage.lcov`
- Integrate into CI for trends; prioritize meaningful paths rather than 100%
  coverage.

**Recommended tasks (example)**

- `test`: `deno test`
- `test:watch`: `deno test --watch`
- `coverage`:
  `deno test --coverage=.cov && deno coverage .cov --lcov > coverage.lcov`
- `check`: `deno fmt --check && deno lint && deno check`

**Browser/E2E (optional)**

- If needed, keep slow browser-level tests in a separate `e2e/` folder and run
  sparingly.
- Follow Deno’s Web Testing (WebDriver BiDi) guidance; do not replace
  integration tests with E2E.

---

## Security & correctness

- Never read env vars on the client; only in server code and via Deno APIs.
- Sanitize any user-controlled strings used in headers or HTML output outside
  JSX.
- CSRF/CORS: use built-in middlewares where applicable.
- Avoid global mutable singletons for per-request data; use `ctx.state`.

---

## Performance guardrails

- Keep islands small; push logic to the server when possible.
- Leverage file-based routing to enable lazy loading of route modules.
- Set cache headers for static assets via `staticFiles()` when appropriate.
- Measure and set headers in a timing middleware; avoid `console.log` in hot
  paths.

---

## PR & commit guidelines for agents

- Run `deno fmt`, `deno lint`, typecheck, and tests locally.
- Keep diffs minimal and isolated by concern (route vs middleware vs island).
- Use clear commit messages (e.g.,
  `feat(routes): add /api/items POST with validation`).
- Do not introduce Node-specific tooling unless explicitly requested; stick to
  Deno/JSR ecosystem.
- Favor incremental, test-backed changes over large refactors.

---

## When adding features: decision checklist

1. **Is this a page or an API?**

   - Page → file route (`routes/...`), `define.page`
   - API → `define.handlers` or programmatic `app.get/post`, returning
     `Response`
2. **Any cross-cutting concerns?**

   - Add/adjust middleware **before** routes
   - Use folder `_middleware.ts` for subtree scope
3. **Does it need client interactivity?**

   - Yes → island in `islands/` with serializable props only
   - No → render as server component
4. **State flow**

   - Use `ctx.state` only for per-request cross-cutting data
   - Use handler-returned `props.data` for page-specific data
5. **Tests**

   - Add/extend integration tests via `app.handler()`

---

## Frequently used snippets (copy/paste)

**Global static assets**

```ts
import { staticFiles } from "fresh";
app.use(staticFiles());
```

**Scoped middleware**

```ts
app.use(
  "/api",
  define.middleware((ctx) => {
    /* auth */ return ctx.next();
  }),
);
```

**Redirect & render**

```ts
app.get("/old", (ctx) => ctx.redirect("/new", 307));
app.get("/hello", (ctx) => ctx.render(<h1>Hello</h1>, { status: 200 }));
```

**Dynamic route with params**

```ts
app.get("/books/:id", (ctx) => new Response(ctx.params.id));
```

**Client-only guard**

```ts
import { IS_BROWSER } from "fresh/runtime";
if (!IS_BROWSER) return <div />; // in an island
```

---

## Out of scope for agents

- Don’t replace Fresh routing with custom routers.
- Don’t add bundlers/build tools that duplicate Deno capabilities.
- Don’t introduce client-side state libraries for simple islands where Signals
  suffice.
- Don’t widen the `State` type without reviewing all middlewares that depend on
  it.

---

**Treat this file as living documentation.** Update sections alongside
significant structural or API changes to Fresh usage
(App/middleware/routing/islands) in this codebase.
