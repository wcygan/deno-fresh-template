---
sidebar_label: Deno Scripting
---

# Deno Scripting

Guidance for repo automation using Deno scripts under `scripts/`. This mirrors
the policy and tooling provided by `scripts/AGENTS.md` and `scripts/init.ts`.

## Overview

- Deno-first: all automation lives in `scripts/` as TypeScript with a Deno shebang.
- No bash/python in `scripts/`; use standard Web APIs and Deno APIs.
- Pin exact versions for imports (prefer JSR, no ranges/caret/tilde).
- Keep permissions explicit and minimal via `--allow-*` flags.

## Quick start

From repo root:

```bash
# Show helper usage and policy
deno task scripts:init

# Scan for non-Deno scripts (.sh/.bash/.py) under scripts/ (fails on violations)
deno task scripts:scan

# Scaffold a new script (creates scripts/my_tool.ts)
deno task scripts:init -- --scaffold my_tool
```

The scaffold includes a Deno shebang, minimal CLI parsing, examples using
`fetch` and `Deno.Command`, and reference links.

## Conventions

- Shebang: `#!/usr/bin/env -S deno run --allow-...` with minimal, explicit permissions.
- Naming: `kebab_case.ts` (e.g., `setup_telepresence.ts`). Group in subfolders when helpful.
- Imports: prefer JSR with exact versions (e.g., `jsr:@std/path@1.0.6`).
- Output: concise, actionable logs; consider JSON for machine-readable output.

## Running scripts

- Direct: `deno run --allow-env --allow-run scripts/foo.ts`
- Via task (preferred for repeatability), add to `deno.json`:

```json
{
  "tasks": {
    "foo": "deno run --allow-env --allow-run scripts/foo.ts"
  }
}
```

Then run with args: `deno task foo -- --flag value`.

## Permissions checklist

- `--allow-run`: spawn subprocesses (e.g., `kubectl`, `git`).
- `--allow-env`: read environment variables.
- `--allow-read` / `--allow-write`: filesystem access (scope paths when possible).
- `--allow-net`: network requests (scope hosts when possible).

Prefer the smallest set needed; avoid `-A` unless essential.

## Policy helper (scripts/init.ts)

`scripts/init.ts` enforces the Deno-first policy and provides scaffolding:

- `--scan`: finds `.sh`, `.bash`, `.py` under `scripts/` and reports them.
- `--fail-on-violations`: exit non-zero if any findings.
- `--scaffold <name>`: creates `scripts/<name>.ts` from a template.

Examples:

```bash
# Scan (non-zero exit on violations)
deno run --allow-read --allow-env scripts/init.ts --scan --fail-on-violations

# Scaffold a script named tools/hello.ts
deno run --allow-read --allow-write --allow-env scripts/init.ts --scaffold tools/hello
```

Scaffolded template highlights:

- Deno shebang with minimal flags.
- CLI usage/help and basic arg parsing.
- `fetch` usage (Web API) and `Deno.Command` subprocess example.
- Reference links to Deno/JSR docs and optional Dax.

## Git hooks

- Pre-commit hook is a Deno script at `scripts/git-hooks/pre-commit`.
- Install/uninstall/status tasks:

```bash
deno task hooks:install
deno task hooks:status
deno task hooks:uninstall
```

The hook runs CI-aligned checks (`fmt`, `lint`, typecheck, tests).

## References

- Deno Scripts/CLIs: https://deno.com/learn/scripts-clis
- JSR with Deno: https://jsr.io/docs/with/deno
- JSR native imports: https://jsr.io/docs/native-imports
- Dax (optional shell helpers): https://github.com/dsherret/dax
- Web APIs: https://docs.deno.com/runtime/reference/web_platform_apis/
- Deno APIs: https://docs.deno.com/runtime/reference/deno_namespace_apis/
