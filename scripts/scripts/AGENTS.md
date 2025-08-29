# Scripting Guidelines (scripts/)

This repository is Deno-first for all automation. Scripts live under `scripts/` and must be TypeScript with a Deno shebang. No bash or python.

## Create New Scripts
- Scaffold via the helper:
  - Direct: `deno run --allow-read --allow-write --allow-env scripts/init.ts --scaffold my_tool`
  - With task: `deno task scripts:init -- --scaffold my_tool`
- This generates `scripts/my_tool.ts` with a Deno shebang, minimal examples (fetch, `Deno.Command`), and reference links.
- Scan for non-Deno scripts: `deno task scripts:scan` (fails on violations).

## Conventions
- Shebang: `#!/usr/bin/env -S deno run --allow-...` with minimal, explicit permissions.
- Naming: `kebab_case.ts` (e.g., `setup_telepresence.ts`). Group related scripts in subfolders if helpful.
- Imports: pin exact versions, prefer JSR. Example: `import { join } from "jsr:@std/path@1.0.6";`
- Output: print concise, actionable logs; prefer JSON for machine-readable summaries when useful.

## Running & Tasks
- Direct: `deno run --allow-env --allow-run scripts/foo.ts`
- Via task: add to `deno.json` (root) for repeatability. Example:
  - `"foo": "deno run --allow-env --allow-run scripts/foo.ts"`
  - Run with args: `deno task foo -- --flag value`

## Permissions Checklist
- `--allow-run`: spawn processes (`kubectl`, `git`, etc.)
- `--allow-env`: read environment variables
- `--allow-read/--allow-write`: filesystem access (scope paths when possible)
- `--allow-net`: network requests (scope hosts when possible)

## Hooks
- Pre-commit hook is a Deno script at `scripts/git-hooks/pre-commit`; it runs `deno task ci:all`.

## Helpful References
- Deno Scripts/CLIs: https://deno.com/learn/scripts-clis
- JSR with Deno: https://jsr.io/docs/with/deno
- Native imports: https://jsr.io/docs/native-imports
- Dax (optional shell helpers): https://github.com/dsherret/dax
- Web APIs: https://docs.deno.com/runtime/reference/web_platform_apis/
- Deno APIs: https://docs.deno.com/runtime/reference/deno_namespace_apis/
