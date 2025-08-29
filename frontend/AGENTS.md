# Repository Guidelines

Concise contributor guide for this Deno Fresh 2.x repository. Prefer JSR imports and standard web APIs; no Node tooling is required for the app.

## Project Structure & Module Organization
- `main.ts`: builds the `App`, registers global middleware, calls `app.fsRoutes()`.
- `routes/`: file-based routes (`index.tsx`, nested folders, `_middleware.ts`).
- `islands/`: interactive, client-hydrated components.
- `components/`: server-only/shared Preact components.
- `static/`: static assets (images, CSS). Served via `staticFiles()`.
- `utils.ts`: `createDefine()` helpers and the shared `State` interface.
- `dev.ts`: dev/build entry (e.g., Tailwind plugin wiring) if present.
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
- Components: `PascalCase` for Preact components; routes mirror URL paths (e.g., `routes/blog/[slug].tsx`).
- Define helpers: import from `utils.ts` (`define.page`, `define.handlers`, `define.middleware`). Keep `State` centralized and minimal.

## Testing Guidelines
- Runner: Deno test. Prefer request/response tests over snapshots.
- Naming: `*_test.ts` or `*_test.tsx` colocated with code.
- Example: `const res = await app.handler()(new Request("http://x/health"));` then assert status/body.
- Aim for fast, deterministic tests; mock external calls.

## Commit & Pull Request Guidelines
- Commits: conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Keep diffs focused.
- PRs: include summary, rationale, linked issues, and instructions to verify. Add screenshots for UI changes.
- CI: ensure `deno fmt`, `deno lint`, typecheck, and tests pass locally before opening a PR.

## Security & Configuration Tips
- Read env/config only on the server via Deno APIs; never in islands.
- Do not store secrets in the repo. Use `.env`/runtime config and access in server code.
- Keep per-request data in `ctx.state` only; avoid global mutable singletons.

