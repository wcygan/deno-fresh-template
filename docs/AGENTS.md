# Repository Guidelines

## Project Structure & Module Organization

- Root config: `docusaurus.config.ts`, `sidebars.ts`, `package.json`, `bun.lock`.
- Content: `docs/` (documentation), `blog/` (posts), `static/` (assets served as-is).
- UI/pages: `src/pages/` (React/TSX pages), `src/css/` (custom styles).
- Build output: `.docusaurus/` (cache) and `build/` (static site after build).

## Build, Test, and Development Commands

- Install: `bun install` — install dependencies (Node ≥ 18 required).
- Dev server: `bun run start` — hot-reload at `http://localhost:3000`.
- Build: `bun run build` — generate static site into `build/`.
- Preview: `bun run serve` — serve the `build/` output locally.
- Clean cache: `bun run clear` — clear Docusaurus cache and artifacts.
- Typecheck: `bun run typecheck` — run TypeScript type checks.
- Deploy (GH Pages): `USE_SSH=true bun run deploy` or `GIT_USER=<username> bun run deploy`.

## Coding Style & Naming Conventions

- TypeScript/React with 2-space indentation; keep imports sorted logically.
- Components: PascalCase (e.g., `MyComponent.tsx`). Docs/blog files: kebab-case (e.g., `getting-started.md`).
- Prefer MDX for rich content; keep headings hierarchical and concise.
- Links: use relative links within `docs/`; place images in `static/img/`.

## Testing Guidelines

- No formal test suite. Validate by building and serving: `bun run build && bun run serve`.
- Check for broken links and missing assets during review; ensure sidebar entries resolve.
- Keep PRs small and scoped; include steps to reproduce and screenshots for UI changes.

## Commit & Pull Request Guidelines

- Commits: prefer Conventional Commits (e.g., `docs: add intro page`, `feat: hero section`).
- PRs: include a clear description, linked issues, and any visual diffs/screenshots.
- Keep diffs minimal; avoid mass formatting changes unrelated to the change.
- Verify `bun run build` passes before requesting review.

## Security & Configuration Tips

- Never commit secrets. Configure deploy creds via environment variables (`USE_SSH`, `GIT_USER`).
- External scripts/styles should be pinned and reviewed before inclusion.
