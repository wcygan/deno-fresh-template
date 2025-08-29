#!/usr/bin/env -S deno run --allow-env

// Idempotent Telepresence setup for remote dev
// - Pins Telepresence client version
// - Ensures traffic-manager is installed and ready
// - Optional connect and intercept
//
// Usage examples:
//   deno run --allow-run --allow-read --allow-write --allow-net scripts/setup_telepresence.ts
//   deno run --allow-run --allow-read --allow-write --allow-net scripts/setup_telepresence.ts --connect
//   deno run --allow-run --allow-read --allow-write --allow-net scripts/setup_telepresence.ts --connect --intercept --service fresh-app --service-namespace app --port 8000
//
// Notes:
// - For remote clusters, this avoids building/pushing images by steering
//   Service traffic to your local dev server via Telepresence.
// - Telepresence may request elevated privileges when connecting to set up
//   networking. If connect fails due to permissions, re-run with appropriate
//   privileges.

type Json = Record<string, unknown>;

function getEnv(name: string): string | undefined {
  try {
    // Access may be denied if --allow-env is not granted
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

const TP_VERSION = getEnv("TELEPRESENCE_VERSION") ?? "v2.24.0"; // pin exact
const TP_MANAGER_NS = parseArg("--manager-namespace") ?? "ambassador";
const DO_CONNECT = hasFlag("--connect");
const DO_INTERCEPT = hasFlag("--intercept");
const DO_LEAVE = hasFlag("--leave");
const DO_QUIT = hasFlag("--quit");
const DO_STATUS = hasFlag("--status");
const INTERCEPT_SERVICE = parseArg("--service") ?? "fresh-app";
const LEAVE_NAME = parseArg("--name") ?? INTERCEPT_SERVICE;
const INTERCEPT_NS = parseArg("--service-namespace") ?? "app";
const INTERCEPT_PORT = parseArg("--port") ?? "8000"; // local service port
// Note: Telepresence v2.24.0 does not support --preview-url or --http-header on
// the intercept command. We keep these parser hooks for compatibility but ignore
// them to avoid CLI errors.
const PREVIEW_URL = hasFlag("--preview-url");
const HTTP_HEADER = parseArg("--http-header"); // e.g., x-user=me (ignored)

function hasFlag(name: string): boolean {
  return Deno.args.includes(name);
}

function parseArg(name: string): string | undefined {
  const i = Deno.args.indexOf(name);
  if (i >= 0 && i < Deno.args.length - 1) return Deno.args[i + 1];
  return undefined;
}

async function runCapture(cmd: string[], opts: Deno.CommandOptions = {}) {
  const p = new Deno.Command(cmd[0], { ...opts, args: cmd.slice(1) }).output();
  const out = await p;
  const stdout = new TextDecoder().decode(out.stdout).trim();
  const stderr = new TextDecoder().decode(out.stderr).trim();
  return { code: out.code, stdout, stderr };
}

function binDir(): string {
  // Resolve to repo-root/.bin relative to this file
  const here = new URL("./", import.meta.url);
  const bin = new URL("../.bin/", here);
  return new URL(bin).pathname;
}

function osArchToAsset(): { url: string; name: string } {
  const os = Deno.build.os; // "darwin" | "linux" | "windows"
  const arch = Deno.build.arch; // "x86_64" | "aarch64" | ...
  if (os === "windows") {
    throw new Error("Windows is not supported by this script.");
  }
  const archMap: Record<string, string> = { x86_64: "amd64", aarch64: "arm64" };
  const a = archMap[arch];
  if (!a) throw new Error(`Unsupported arch: ${arch}`);
  const name = `telepresence-${os}-${a}`;
  const url = `https://github.com/telepresenceio/telepresence/releases/download/${TP_VERSION}/${name}`;
  return { url, name };
}

async function ensureDir(path: string) {
  await Deno.mkdir(path, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const st = await Deno.stat(path);
    return st.isFile;
  } catch {
    return false;
  }
}

async function ensureTelepresenceBinary(): Promise<{ path: string; version?: string; source: string }> {
  // Prefer system telepresence if present and matches pinned version
  let { code, stdout } = await runCapture(["telepresence", "version"]).catch(() => ({ code: 1, stdout: "" } as const));
  if (code === 0) {
    const version = parseTpVersion(stdout);
    if (version === TP_VERSION.replace(/^v/, "v")) {
      return { path: "telepresence", version, source: "system" };
    }
  }

  // Fallback: download pinned client to repo .bin
  const { url, name } = osArchToAsset();
  const targetDir = binDir();
  await ensureDir(targetDir);
  const target = `${targetDir}telepresence`;

  // If already downloaded, keep it
  if (!(await fileExists(target))) {
    const resp = await fetch(url);
    if (!resp.ok || !resp.body) {
      throw new Error(`Failed to download telepresence ${TP_VERSION} from ${url}: ${resp.status}`);
    }
    const f = await Deno.open(target, { create: true, write: true, truncate: true });
    try {
      for await (const chunk of resp.body) {
        await f.write(chunk);
      }
    } finally {
      f.close();
    }
    await Deno.chmod(target, 0o755);
  }

  ({ code, stdout } = await runCapture([target, "version"]));
  const version = code === 0 ? parseTpVersion(stdout) : undefined;
  return { path: target, version, source: "bundled" };
}

function parseTpVersion(text: string): string | undefined {
  // Example: "Client: v2.24.0 (api v3)\nRoot Daemon: not running\nUser Daemon: not running"
  const m = text.match(/Client:\s*(v\d+\.\d+\.\d+)/i);
  return m?.[1];
}

async function nsExists(ns: string): Promise<boolean> {
  const { code } = await runCapture(["kubectl", "get", "ns", ns]);
  return code === 0;
}

async function ensureNamespace(ns: string) {
  if (!(await nsExists(ns))) {
    const { code, stderr } = await runCapture(["kubectl", "create", "ns", ns]);
    if (code !== 0) throw new Error(`Failed to create namespace ${ns}: ${stderr}`);
  }
}

async function getCurrentNamespace(): Promise<string | undefined> {
  const { code, stdout } = await runCapture([
    "kubectl",
    "config",
    "view",
    "--minify",
    "--output",
    "jsonpath={..namespace}",
  ]);
  if (code !== 0) return undefined;
  return stdout || undefined;
}

async function setCurrentNamespace(ns: string): Promise<boolean> {
  const { code } = await runCapture([
    "kubectl",
    "config",
    "set-context",
    "--current",
    `--namespace=${ns}`,
  ]);
  return code === 0;
}

async function getTrafficManagerStatus(ns: string): Promise<{ installed: boolean; ready: boolean; availableReplicas: number }> {
  const res = await runCapture([
    "kubectl",
    "-n",
    ns,
    "get",
    "deploy",
    "traffic-manager",
    "-o",
    "json",
  ]);
  if (res.code !== 0) return { installed: false, ready: false, availableReplicas: 0 };
  try {
    const obj = JSON.parse(res.stdout) as Json;
    const status = (obj.status ?? {}) as Json;
    const avail = Number(status["availableReplicas"]) || 0;
    return { installed: true, ready: avail > 0, availableReplicas: avail };
  } catch {
    return { installed: true, ready: false, availableReplicas: 0 };
  }
}

async function installTrafficManager(tpPath: string, ns: string): Promise<void> {
  await ensureNamespace(ns);
  const { code, stderr } = await runCapture([tpPath, "helm", "install", "--namespace", ns]);
  if (code !== 0) {
    throw new Error(`telepresence helm install failed: ${stderr}`);
  }
}

async function waitForTrafficManager(ns: string, timeoutMs = 120_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await getTrafficManagerStatus(ns);
    if (st.installed && st.ready) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function connect(tpPath: string, ns?: string): Promise<{ connected: boolean; message?: string }> {
  const args = [tpPath, "connect"];
  if (ns) {
    args.push("--namespace", ns);
  }
  const { code, stdout, stderr } = await runCapture(args);
  const ok = code === 0;
  return { connected: ok, message: ok ? stdout : stderr || stdout };
}

async function tpQuit(tpPath: string): Promise<void> {
  await runCapture([tpPath, "quit"]);
}

async function tpLeave(tpPath: string, name?: string): Promise<{ ok: boolean; message?: string }> {
  const args = [tpPath, "leave"];
  if (name) args.push(name);
  const { code, stdout, stderr } = await runCapture(args);
  const ok = code === 0 || /not found|no such intercept/i.test(stderr + stdout);
  return { ok, message: ok ? stdout : stderr || stdout };
}

async function tpStatus(tpPath: string): Promise<{ ok: boolean; json?: Json; raw?: string }> {
  const { code, stdout, stderr } = await runCapture([tpPath, "status", "--output=json"]);
  if (code !== 0) return { ok: false, raw: stderr || stdout };
  try {
    const obj = JSON.parse(stdout) as Json;
    return { ok: true, json: obj };
  } catch {
    return { ok: false, raw: stdout };
  }
}

async function intercept(tpPath: string): Promise<{ intercepted: boolean; message?: string }> {
  // Telepresence v2.24.0 uses the current kubectl context namespace.
  const args = [
    tpPath,
    "intercept",
    INTERCEPT_SERVICE,
    "--port",
    `${INTERCEPT_PORT}:http`,
  ];
  // Ignore PREVIEW_URL/HTTP_HEADER; not supported by this TP version.
  const { code, stdout, stderr } = await runCapture(args);
  const ok = code === 0 || /already exists|already intercepted/i.test(stderr + stdout);
  const msg = (PREVIEW_URL ? "(preview-url ignored)\n" : "") + (stderr || stdout);
  return { intercepted: ok, message: ok ? stdout : msg };
}

async function main() {
  const client = await ensureTelepresenceBinary();
  const mgr = await getTrafficManagerStatus(TP_MANAGER_NS);
  let installed = mgr.installed;
  let ready = mgr.ready;

  const actions: string[] = [];

  if (!installed) {
    await installTrafficManager(client.path, TP_MANAGER_NS);
    actions.push(`installed traffic-manager in ${TP_MANAGER_NS}`);
    ready = await waitForTrafficManager(TP_MANAGER_NS);
  } else if (!ready) {
    // Give it a chance to become ready
    ready = await waitForTrafficManager(TP_MANAGER_NS);
  }

  let connected: boolean | undefined;
  let connectRes: { connected: boolean; message?: string } | undefined;
  let interceptRes: { intercepted: boolean; message?: string } | undefined;
  let leaveRes: { ok: boolean; message?: string } | undefined;
  let statusRes: { ok: boolean; json?: Json; raw?: string } | undefined;

  if (DO_LEAVE) {
    // Leave does not require connection, but the daemon must be reachable.
    leaveRes = await tpLeave(client.path, LEAVE_NAME);
    actions.push(leaveRes.ok ? `left ${LEAVE_NAME}` : `leave failed (${LEAVE_NAME})`);
  }

  if (DO_QUIT) {
    await tpQuit(client.path);
    actions.push("quit");
  }

  if (DO_STATUS) {
    statusRes = await tpStatus(client.path);
    actions.push(statusRes.ok ? "status" : "status failed");
  }

  if (DO_CONNECT || DO_INTERCEPT) {
    // Ensure target namespace exists; connect will scope to it.
    if (DO_INTERCEPT) await ensureNamespace(INTERCEPT_NS);
    connectRes = await connect(client.path, DO_INTERCEPT ? INTERCEPT_NS : undefined);
    connected = connectRes.connected;
    if (!connected && /Cluster configuration changed/i.test(connectRes.message ?? "")) {
      await tpQuit(client.path);
      connectRes = await connect(client.path, DO_INTERCEPT ? INTERCEPT_NS : undefined);
      connected = connectRes.connected;
    }
    actions.push(connected ? "connected" : "connect failed");
    if (DO_INTERCEPT && connected) {
      interceptRes = await intercept(client.path);
      actions.push(interceptRes.intercepted ? "intercepted" : "intercept failed");
    }
  }

  const summary = {
    client: {
      versionPinned: TP_VERSION,
      usedVersion: client.version ?? null,
      path: client.path,
      source: client.source,
    },
    manager: {
      namespace: TP_MANAGER_NS,
      installed: installed || ready,
      ready,
    },
    connect: DO_CONNECT ? { attempted: true, connected: connected ?? false, message: connectRes?.message ?? null } : { attempted: false },
    intercept: DO_INTERCEPT ? {
      attempted: true,
      service: INTERCEPT_SERVICE,
      namespace: INTERCEPT_NS,
      port: INTERCEPT_PORT,
      result: interceptRes ?? null,
    } : { attempted: false },
    leave: DO_LEAVE ? {
      attempted: true,
      name: LEAVE_NAME,
      result: leaveRes ?? null,
    } : { attempted: false },
    quit: DO_QUIT ? { attempted: true } : { attempted: false },
    status: DO_STATUS ? { attempted: true, result: statusRes ?? null } : { attempted: false },
    actions,
  } satisfies Json;

  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.main) {
  await main();
}
