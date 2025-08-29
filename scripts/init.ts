#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * Deno-first scripts initializer and policy enforcer.
 *
 * - Mandates Deno scripting over bash/python for repo automation.
 * - Scans for non-Deno scripts under `scripts/`.
 * - Scaffolds new Deno CLI scripts with pinned imports and references.
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-env scripts/init.ts [options]
 *
 * Options:
 *   --scan                 Scan for .sh/.bash/.py under scripts/ and report
 *   --fail-on-violations   Exit non-zero when violations found
 *   --scaffold <name>      Create scripts/<name>.ts from a template
 *   -h, --help             Show help
 *
 * References:
 * - Deno scripts/CLIs: https://deno.com/learn/scripts-clis
 * - JSR with Deno: https://jsr.io/docs/with/deno
 * - JSR native imports: https://jsr.io/docs/native-imports
 * - Dax (shell UX): https://github.com/dsherret/dax
 * - Web APIs: https://docs.deno.com/runtime/reference/web_platform_apis/
 * - Deno APIs: https://docs.deno.com/runtime/reference/deno_namespace_apis/
 */

import { join } from "jsr:@std/path@1.0.6";

const POLICY = `Deno-first scripting policy\n\n- Use Deno for all repo automation scripts (no bash/python).\n- Prefer JSR imports with exact versions; avoid ranges.\n- Use standard Web APIs and Deno namespace APIs.\n- Keep scripts self-contained with explicit --allow-* permissions.\n`;

function help() {
  console.log(`${POLICY}\nUsage: scripts/init.ts [options]\n\nOptions:\n  --scan                 Scan for .sh/.bash/.py under scripts/ and report\n  --fail-on-violations   Exit non-zero when violations found\n  --scaffold <name>      Create scripts/<name>.ts from a template\n  -h, --help             Show help\n\nRefs:\n  - Deno scripts/CLIs: https://deno.com/learn/scripts-clis\n  - JSR with Deno: https://jsr.io/docs/with/deno\n  - JSR native imports: https://jsr.io/docs/native-imports\n  - Dax: https://github.com/dsherret/dax\n  - Web APIs: https://docs.deno.com/runtime/reference/web_platform_apis/\n  - Deno APIs: https://docs.deno.com/runtime/reference/deno_namespace_apis/\n`);
}

async function scanScripts(root = Deno.cwd()) {
  const scriptsDir = join(root, "scripts");
  const findings: string[] = [];
  try {
    for await (const entry of Deno.readDir(scriptsDir)) {
      if (entry.isFile) {
        const ext = entry.name.split(".").pop()?.toLowerCase();
        if (ext === "sh" || ext === "bash" || ext === "py") {
          findings.push(join("scripts", entry.name));
        }
      }
      if (entry.isDirectory) {
        const sub = join(scriptsDir, entry.name);
        for await (const subEntry of Deno.readDir(sub)) {
          if (subEntry.isFile) {
            const ext = subEntry.name.split(".").pop()?.toLowerCase();
            if (ext === "sh" || ext === "bash" || ext === "py") {
              findings.push(join("scripts", entry.name, subEntry.name));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Scan error:", err);
  }
  return findings;
}

function parseArgs(args: string[]) {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--scan") out.scan = true;
    else if (a === "--fail-on-violations") out["fail-on-violations"] = true;
    else if (a === "--scaffold") {
      out.scaffold = args[i + 1];
      i++;
    }
  }
  return out as { help?: boolean; scan?: boolean; "fail-on-violations"?: boolean; scaffold?: string };
}

async function scaffold(name: string) {
  const file = name.endsWith(".ts") ? name : `${name}.ts`;
  const outPath = join("scripts", file);
  const exists = await fileExists(outPath);
  if (exists) {
    console.error(`Refusing to overwrite existing file: ${outPath}`);
    Deno.exit(1);
  }
  const template = `#!/usr/bin/env -S deno run --allow-env --allow-run
/**
 * ${file}
 * Deno CLI script scaffold.
 *
 * Policy: Prefer Deno over bash/python. Use exact JSR versions.
 *
 * References:
 * - Deno scripts/CLIs: https://deno.com/learn/scripts-clis
 * - JSR with Deno: https://jsr.io/docs/with/deno
 * - JSR native imports: https://jsr.io/docs/native-imports
 * - Dax (optional): https://github.com/dsherret/dax
 * - Web APIs: https://docs.deno.com/runtime/reference/web_platform_apis/
 * - Deno APIs: https://docs.deno.com/runtime/reference/deno_namespace_apis/
 */

function usage() {
  console.log("Usage: deno run -A scripts/${file} [--name <value>]");
}

async function run(cmd: string[], inherit = true) {
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: inherit ? "inherit" : "piped",
    stderr: inherit ? "inherit" : "piped",
  });
  return await p.output();
}

async function main() {
  const raw = Deno.args;
  let help = false;
  let name: string | undefined;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "-h" || a === "--help") help = true;
    else if (a === "--name") { name = raw[i + 1]; i++; }
  }
  if (help) {
    usage();
    return;
  }
  const who = name ?? "world";
  console.log("Hello, " + who + "!");
  // Example: use Web API fetch
  const res = await fetch("https://example.com", { method: "HEAD" });
  console.log("example.com status:", res.status);
  // Example: run a subprocess
  const out = await run(["deno", "--version"], false);
  console.log(new TextDecoder().decode(out.stdout).trim());
}

if (import.meta.main) {
  await main();
}
`;
  await Deno.writeTextFile(outPath, template);
  await Deno.chmod(outPath, 0o755)
  console.log(`Created ${outPath}`);
}

async function fileExists(p: string) {
  try {
    await Deno.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(Deno.args);
  if (args.help || (!args.scan && !args.scaffold)) {
    help();
    return;
  }
  if (args.scan) {
    console.log(POLICY);
    const findings = await scanScripts();
    if (findings.length === 0) {
      console.log("No non-Deno scripts found under scripts/.");
    } else {
      console.error("Found non-Deno scripts under scripts/ (please migrate):");
      for (const f of findings) console.error(` - ${f}`);
      if (args["fail-on-violations"]) Deno.exit(2);
    }
  }
  if (args.scaffold) {
    await scaffold(String(args.scaffold));
  }
}

if (import.meta.main) {
  await main();
}
