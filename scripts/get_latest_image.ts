#!/usr/bin/env -S deno run --allow-env

// Query the newest public GHCR image tag for this repo, no GH token needed.
// Usage: deno run --allow-net scripts/get_latest_image.ts
// Env (optional):
//   TAG_PREFIX   - only consider tags starting with this prefix (e.g., "main-")
//   PLATFORM_OS  - OS to pick from multi-arch index (default: linux)
//   PLATFORM_ARCH- Arch to pick from multi-arch index (default: amd64)

const OWNER = "wcygan";
const IMAGE = "deno-fresh-template/frontend";

const TAG_PREFIX = Deno.env.get("TAG_PREFIX") ?? "";
const PLATFORM_OS = Deno.env.get("PLATFORM_OS") ?? "linux";
const PLATFORM_ARCH = Deno.env.get("PLATFORM_ARCH") ?? "amd64";

function assert(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error(msg);
}

async function getAnonToken(owner: string, image: string): Promise<string> {
  const url =
    `https://ghcr.io/token?service=ghcr.io&scope=repository:${owner}/${image}:pull`;
  const res = await fetch(url);
  assert(res.ok, `Token error: ${res.status}`);
  const data = await res.json();
  assert(typeof data?.token === "string", "No token in response");
  return data.token as string;
}

async function listTags(
  owner: string,
  image: string,
  token: string,
): Promise<string[]> {
  const url = `https://ghcr.io/v2/${owner}/${image}/tags/list`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.ok, `Tags error: ${res.status}`);
  const data = await res.json();
  const tags: string[] = Array.isArray(data?.tags) ? data.tags : [];
  return tags;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<unknown | null> {
  const res = await fetch(url, init);
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function manifestForTag(
  owner: string,
  image: string,
  token: string,
  tag: string,
): Promise<unknown | null> {
  const accept = [
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
  ].join(", ");
  const url = `https://ghcr.io/v2/${owner}/${image}/manifests/${tag}`;
  return await fetchJson(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
  });
}

async function resolveConfigDigestFromManifest(
  owner: string,
  image: string,
  token: string,
  man: unknown,
): Promise<string | null> {
  const mediaType = (man && typeof man === "object" && "mediaType" in man)
    // deno-lint-ignore no-explicit-any
    ? String((man as any).mediaType ?? "")
    : "";
  if (
    mediaType.includes("manifest.v2+json") ||
    mediaType.includes("image.manifest.v1+json")
  ) {
    const cfg = (man && typeof man === "object" && "config" in man)
      // deno-lint-ignore no-explicit-any
      ? (man as any).config
      : undefined;
    return typeof cfg?.digest === "string" ? cfg.digest : null;
  }
  // Assume index/list: pick the desired platform manifest digest
  const manifests = (man && typeof man === "object" && "manifests" in man)
    // deno-lint-ignore no-explicit-any
    ? (Array.isArray((man as any).manifests) ? (man as any).manifests : [])
    : [];
  const preferred = manifests.find((x) =>
    x && typeof x === "object" &&
    // deno-lint-ignore no-explicit-any
    (x as any)?.platform?.os === PLATFORM_OS &&
    // deno-lint-ignore no-explicit-any
    (x as any)?.platform?.architecture === PLATFORM_ARCH
  ) ?? manifests[0];
  const digest = preferred && typeof preferred === "object"
    // deno-lint-ignore no-explicit-any
    ? (preferred as any).digest
    : undefined;
  if (!digest || typeof digest !== "string") return null;

  const accept =
    "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json";
  const url = `https://ghcr.io/v2/${owner}/${image}/manifests/${digest}`;
  const sub = await fetchJson(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
  });
  if (!sub) return null;
  return typeof sub?.config?.digest === "string" ? sub.config.digest : null;
}

async function createdTimestamp(
  owner: string,
  image: string,
  token: string,
  tag: string,
): Promise<number | null> {
  const man = await manifestForTag(owner, image, token, tag);
  if (!man) return null;
  const cfgDigest = await resolveConfigDigestFromManifest(
    owner,
    image,
    token,
    man,
  );
  if (!cfgDigest) return null;
  const cfgUrl = `https://ghcr.io/v2/${owner}/${image}/blobs/${cfgDigest}`;
  const cfg = await fetchJson(cfgUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const created = cfg?.created;
  if (typeof created !== "string" || !created) return null;
  // Normalize fractional seconds for Date.parse
  const clean = created.replace(/\.[0-9]+Z$/, "Z");
  const ts = Date.parse(clean);
  return Number.isFinite(ts) ? ts : null;
}

async function main() {
  const token = await getAnonToken(OWNER, IMAGE);
  const allTags = await listTags(OWNER, IMAGE, token);
  if (!allTags.length) {
    console.error("No tags found");
    Deno.exit(1);
  }

  const candidates = TAG_PREFIX
    ? allTags.filter((t) => t.startsWith(TAG_PREFIX))
    : allTags;
  if (!candidates.length) {
    console.error("No tags matching TAG_PREFIX");
    Deno.exit(1);
  }

  // Score and choose newest by created timestamp
  const scored = await Promise.all(
    candidates.map(async (tag) => ({
      tag,
      ts: await createdTimestamp(OWNER, IMAGE, token, tag),
    })),
  );
  const valid = scored.filter((x) => x.ts != null).sort((
    a,
    b,
  ) => (b.ts! - a.ts!));
  const best = valid[0] ?? { tag: candidates[0], ts: null };

  const result = {
    image: `ghcr.io/${OWNER}/${IMAGE}:${best.tag}`,
    tag: best.tag,
    timestamp: best.ts,
    platform: `${PLATFORM_OS}/${PLATFORM_ARCH}`,
  };
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main();
}
