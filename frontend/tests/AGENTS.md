# Tests: AGENTS Guide

Canonical guidance for operating, extending, maintaining, and refactoring tests
in this Fresh 2.x app. Mirrors project-wide conventions in `frontend/AGENTS.md`
with deeper, test-specific practices.

## Quick Start

- Run all tests: `deno task test`
- Watch mode: `deno task test:watch`
- Coverage (lcov): `deno task coverage`
- Minimal run (no tasks): `deno test`
 - Filter tests by name: `deno test --filter "metrics|healthz"`
 - Stop on first failure: `deno test --fail-fast`

Notes

- Default to zero permissions. This repo’s tasks use `--allow-env` because some
  tests read configuration. Add specific flags only when needed.
- Keep tests deterministic and fast; stub external boundaries and freeze time
  with `FakeTime` when appropriate.

## Deno Testing Fundamentals

- Define tests with `Deno.test(name, fn)` or `Deno.test({ name, fn, ...opts })`.
- Tests run in parallel by default; avoid shared mutable state and ordering
  assumptions. If ordering is necessary, use a single test with substeps.
- Subtests via `t.step(name, fn)` are ideal for table-driven inputs or grouped
  setup/teardown inside one logical test.
- Helpful options:
  - `ignore`: skip a test (can be conditional via env flags).
  - `permissions`: per-test permissions (e.g., `{ env: true }`).
  - `sanitizeOps`, `sanitizeResources`, `sanitizeExit`: keep enabled to catch
    leaks; only disable temporarily to diagnose issues.
- Useful flags: `--filter <regex>`, `--fail-fast`, `--coverage=<dir>`.

## Philosophy

- Integration-first: prefer request/response tests via `app.handler()`.
- Unit tests selectively for small helpers and island logic (no DOM).
- Snapshots sparingly for small, stable fragments.
- No real network, FS, or external services in tests.

## Local Helpers

- Shared test utilities are in `tests/_helpers.ts` (handler, request builder,
  simple body readers). Use them to reduce duplication and keep tests focused.
  See the bottom of this guide for the helper’s contents and usage.

## Layout & Naming

- Integration tests live here: `frontend/tests/`
  - Examples: `app_test.ts`, `integration_test.ts`, `metrics_test.ts`,
    `otel_trace_header_test.ts`, `env_test.ts`.
- Co-located unit tests near code:
  - `components/Button_test.tsx`, `utils/format_test.ts`,
    `islands/Counter_logic_test.ts` (logic-only).
- Filenames end with `*_test.ts` or `*_test.tsx`. Snapshots live beside tests
  in `__snapshots__/`.

## Patterns & Examples

### Integration (preferred)

Use the programmatic handler; assert status, headers, and bodies.

```ts
import { app } from "../main.ts";
import { assert, assertEquals } from "jsr:@std/assert";

const h = app.handler();

Deno.test("/ returns HTML", async () => {
  const res = await h(new Request("http://x/"));
  assertEquals(res.status, 200);
  assert(res.headers.get("content-type")?.includes("text/html"));
});

Deno.test("/api2/:name formats greeting", async () => {
  const res = await h(new Request("http://x/api2/jessie"));
  assertEquals(await res.text(), "Hello, Jessie!");
});
```

Middleware assertions work the same way; hit a route in scope and check
headers/status/redirects.

### Unit (targeted)

Pure helpers and island logic that do not require the DOM.

```ts
import { assertEquals } from "jsr:@std/assert";
import { formatPrice } from "../utils/format.ts";

Deno.test("formatPrice", () => {
  assertEquals(formatPrice(1234.5), "$1,234.50");
});
```

### Mocks, Spies, Fake Time

```ts
import { FakeTime, spy, stub } from "jsr:@std/testing/mock";
import { assertEquals } from "jsr:@std/assert";

Deno.test("stub fetch", async () => {
  using s = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok")));
  // call code that uses fetch()
});

Deno.test("spy console.log", () => {
  using s = spy(console, "log");
  console.log("hello");
  assertEquals(s.calls.length, 1);
});

Deno.test("fake time", () => {
  using time = new FakeTime(1710000000000);
  // code depending on Date.now()/performance.now()
});
```

### Snapshots (sparingly)

Use for small, stable fragments. Update with explicit flags.

```ts
import { assertSnapshot } from "jsr:@std/testing/snapshot";

Deno.test("hero fragment", async (t) => {
  const html = "<section>Hero</section>";
  await assertSnapshot(t, html);
});
// Update: deno test --allow-read --allow-write -- --update
```

## BDD Style (Describe/It)

- You can use `jsr:@std/testing/bdd` for a describe/it style when it clarifies
  intent. Keep usage consistent and minimal.

```ts
import { describe, it, beforeEach, afterEach } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

describe("/api2 greeting", () => {
  it("formats name", async () => {
    const res = await h(req("/api2/jessie"));
    assertEquals(await res.text(), "Hello, Jessie!");
  });
});
```

## Web Testing (E2E)

- Prefer integration tests via `app.handler()`. For browser-level validation,
  keep E2E tests in `e2e/` and follow Deno’s Web Testing (WebDriver BiDi)
  docs. Run with restricted permissions (e.g., `--allow-net=localhost`).
- E2E should be sparse and focus on critical user flows; integration tests
  provide breadth and speed.

## Adding Tests for New Code

- New route: add an integration test that targets the route via `app.handler()`
  and asserts status, `content-type`, and key body content. Prefer minimal,
  behavior-driven assertions (avoid brittle full-body equality unless trivial).
- New middleware: test against any route in scope and assert added headers or
  behaviors (e.g., redirects, CORS preflight handling).
- New env/config: add unit tests around the parser/validator (e.g.,
  `loadEnv()`), asserting defaults, overrides, and invalid cases.
- New metrics: trigger a representative request, then fetch `/metrics` and
  assert key lines exist.
- New islands: test logic-only pieces (signals/reducers) in isolation.

Table-driven example with substeps:

```ts
import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test("/api2 formats names", async (t) => {
  for (const [name, expected] of [
    ["jessie", "Hello, Jessie!"],
    ["taylor", "Hello, Taylor!"],
  ] as const) {
    await t.step(name, async () => {
      const res = await h(req(`/api2/${name}`));
      assertEquals(await res.text(), expected);
    });
  }
});
```

## Permissions

- Start with zero permissions. Add only what a test needs.
- Common cases:
  - Env/config: `--allow-env` or per-test `permissions: { env: true }`.
  - Snapshots: `--allow-read --allow-write` to manage snapshot files.
  - Network/file I/O: scope tightly (`--allow-net=localhost`,
    `--allow-read=./static`).

Per-test permissions example:

```ts
Deno.test({
  name: "reads OTEL env",
  permissions: { env: true },
  async fn() {
    // ...
  },
});
```

Conditional tests (skip when not applicable):

```ts
Deno.test({
  name: "trace header present when OTEL enabled",
  ignore: Deno.env.get("OTEL_DENO") !== "true",
  permissions: { env: true },
  async fn() { /* ... */ },
});
```

## Refactoring & Maintenance

- Remove duplication with tiny helpers; colocate in `tests/_helpers.ts` if it
  grows beyond a few lines (do not create general utility modules prematurely).
- Prefer table-driven tests for many similar inputs/outputs.
- Keep assertions resilient: check `content-type` includes and key substrings
  instead of exact long HTML matches.
- Stabilize time and randomness with `FakeTime` and deterministic seeds.
- Keep imports pinned to exact versions (no `latest`, `^`, `~`, or ranges).
- Update `deno.lock` intentionally: run with `--reload` when bumping deps and
  commit the lockfile in the same PR.
- Flakiness: eliminate sleeps and real network; use stubs and fake clocks.
- Snapshots: review updates; avoid wide or fast-changing content in snapshots.
 - Parallelism: avoid shared mutable state; serialize via one test with
   `t.step()` if a shared resource is unavoidable.
 - Filtering: use `--filter` while iterating; ensure no focused `.only` tests
   remain in commits.

## Coverage

- Generate locally: `deno task coverage`
- Interpreting results: focus on meaningful paths; avoid chasing 100%.
- If coverage data becomes stale, clear `.cov/` and regenerate.
 - Excluding generated/vendor code: configure ignore patterns so coverage
   reflects app code.

## CI & Pre-merge Checklist

- Run: `deno fmt`, `deno lint`, typecheck (`deno check`), and tests.
- Ensure tasks succeed: `deno task test` (includes coverage in this repo).
- Keep diffs focused and pinned versions intact; no wildcard versions.
 - No `.only` in committed tests; avoid unexplained skipped tests.

## When to Introduce Test Helpers

Introduce a tiny local helper when duplication appears in 3+ tests. Examples:

```ts
// tests/_helpers.ts
import { app } from "../main.ts";
export const h = app.handler();
export const req = (path: string, init?: RequestInit) =>
  new Request(`http://x${path}`, init);
```

Usage:

```ts
import { h, req } from "./_helpers.ts";
const res = await h(req("/healthz"));
```

Keep helpers tiny, local to tests, and free of app logic. If a helper grows
complex, revisit whether it’s necessary.

---

This guide evolves with the app. When changing app structure, middleware
ordering, or test tasks/permissions, update this file alongside the change.
