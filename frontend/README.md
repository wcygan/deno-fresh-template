# Fresh project

Quick start for this Deno Fresh 2.x template.

## Commands

- Dev: `deno task dev`
- Build: `deno task build`
- Start (serve built app): `deno task start`
- Tests: `deno test --allow-env --allow-read`
- Check: `deno fmt --check && deno lint && deno check`

## Middleware customization

Global middlewares are composed in `main.ts` via `createMiddlewareStack()`.

```ts
import { createMiddlewareStack, middlewares } from "./middleware/index.ts";
for (const mw of createMiddlewareStack()) app.use(mw);
// Scoped example: rate limit only /api
app.use("/api", middlewares.rateLimit());
```

Folder-scoped middleware lives under route folders, e.g.
`routes/api/_middleware.ts` applies CORS only to `/api/*`.

## Environment

See `.env.example` for common variables (CSP, rate limit, HSTS, OTEL). Use
`frontend/env.ts` for typed parsing and `config.security` for header knobs.

## Docs

Refer to `../AGENTS.md` and `frontend/AGENTS.md` for conventions, testing, and
version pinning.
