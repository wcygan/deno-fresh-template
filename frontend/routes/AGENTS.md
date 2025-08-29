# Repository Guidelines

## Project Structure & Entry Points
- `main.ts`: builds the single `App`, registers middleware, calls `app.fsRoutes()`.
- `routes/`: file routes (`index.tsx`, nested folders, `_middleware.ts`).
- `islands/` and `components/`: client-hydrated vs server-only UI.
- `utils.ts`: `createDefine()` helpers and shared `State` type.
- `env.ts`: server-only config; do not import from islands.

## Routing (Fresh canary)
- File routes map directly: `routes/blog/[slug].tsx` → `/blog/:slug`.
- Dynamic segments and wildcards: `/books/:id`, `/files/*` with `ctx.params`.
- Folder middleware (`routes/**/_middleware.ts`) applies to that subtree.
- Programmatic routes live in `main.ts` (`app.get/post/...`). Order matters; place middleware before routes. Always call `app.fsRoutes()` once.
- Handlers + pages are type-safe via define helpers:
  ```ts
  // routes/example.tsx
  export const handler = define.handlers({ GET: () => ({ data: { msg: "Hi" } }) });
  export default define.page<typeof handler>((p) => <p>{p.data.msg}</p>);
  ```

## Context (per-request API)
- Access request data via `ctx.url`, `ctx.req`, `ctx.route`, `ctx.params`.
- Use `ctx.state` (typed by `State`) for cross-cutting, serializable data only.
- Render/redirect: `ctx.render(<h1/> , { status })`, `ctx.redirect("/path", 307)`.
- Middleware composes around `await ctx.next()`:
  ```ts
  export default define.middleware(async (ctx) => {
    ctx.state.requestId = crypto.randomUUID();
    const res = await ctx.next();
    res.headers.set("server", "fresh");
    return res;
  });
  ```

## Dev, Build, Test
- Dev: `deno task dev`; Build: `deno task build`; Start: `deno task start`.
- Quality: `deno fmt && deno lint && deno check`.
- Tests: prefer integration via `app.handler()`:
  ```ts
  const res = await app.handler()(new Request("http://x/health"));
  ```

## Commits & PRs
- Conventional commits (`feat:`, `fix:`, `docs:`). Keep diffs focused.
- PRs: include summary, rationale, verification steps; link issues and add screenshots for UI.
