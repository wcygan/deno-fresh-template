// Check alignment between:
// 1) Latest GHCR image tag (via existing task `image:latest`)
// 2) Image specified in k8s/deployment.yaml
// 3) Images actually running on Pods in the `app` namespace
//
// Usage:
//   deno run --allow-run --allow-read --allow-net scripts/check_cluster_sync.ts
//
// Permissions:
// - --allow-run: run `deno task image:latest` and `kubectl`
// - --allow-read: read k8s/deployment.yaml
// - --allow-net: image:latest script fetches from GHCR

import { parse } from "jsr:@std/yaml@1.0.3";

type PodList = {
  items?: Array<{
    metadata?: { name?: string };
    status?: {
      phase?: string;
      containerStatuses?: Array<{
        name?: string;
        image?: string;
        ready?: boolean;
      }>;
    };
  }>;
};

async function runCapture(cmd: string[], opts: Deno.CommandOptions = {}) {
  const p = new Deno.Command(cmd[0], { ...opts, args: cmd.slice(1) }).output();
  const out = await p;
  const stdout = new TextDecoder().decode(out.stdout).trim();
  const stderr = new TextDecoder().decode(out.stderr).trim();
  return { code: out.code, stdout, stderr };
}

async function getLatestImage(): Promise<
  { image: string; tag: string } | null
> {
  try {
    const { code, stdout, stderr } = await runCapture([
      "deno",
      "task",
      "image:latest",
    ]);
    if (code !== 0) {
      console.error("image:latest task failed:", stderr);
      return null;
    }
    const data = JSON.parse(stdout);
    if (typeof data?.image === "string" && typeof data?.tag === "string") {
      return { image: data.image, tag: data.tag };
    }
  } catch (e) {
    console.error("Failed to get latest image:", e);
  }
  return null;
}

async function getManifestImage(
  path = "k8s/deployment.yaml",
): Promise<string | null> {
  try {
    const text = await Deno.readTextFile(path);
    const doc = parse(text) as unknown;
    if (!doc || typeof doc !== "object") return null;
    const spec = (doc as Record<string, unknown>).spec;
    if (!spec || typeof spec !== "object") return null;
    const template = (spec as Record<string, unknown>).template;
    if (!template || typeof template !== "object") return null;
    const tmplSpec = (template as Record<string, unknown>).spec;
    if (!tmplSpec || typeof tmplSpec !== "object") return null;
    const containers = (tmplSpec as Record<string, unknown>).containers;
    if (!Array.isArray(containers) || containers.length === 0) return null;
    const first = containers[0];
    if (!first || typeof first !== "object") return null;
    const img = (first as Record<string, unknown>).image;
    return typeof img === "string" ? img : null;
  } catch (e) {
    console.error("Failed to read/parse manifest:", e);
    return null;
  }
}

async function getRunningPodsByImage(
  ns = "app",
  label = "app=fresh-app",
): Promise<Record<string, number> | null> {
  try {
    const { code, stdout, stderr } = await runCapture([
      "kubectl",
      "-n",
      ns,
      "get",
      "pods",
      "-l",
      label,
      "-o",
      "json",
    ]);
    if (code !== 0) {
      console.error("kubectl error:", stderr);
      return null;
    }
    const data = JSON.parse(stdout) as PodList;
    const byImage: Record<string, number> = {};
    for (const pod of data.items ?? []) {
      if (pod?.status?.phase !== "Running") continue;
      for (const cs of pod.status?.containerStatuses ?? []) {
        const image = cs?.image;
        if (!image) continue;
        byImage[image] = (byImage[image] ?? 0) + 1;
      }
    }
    return byImage;
  } catch (e) {
    console.error("Failed to query pods:", e);
    return null;
  }
}

function computeSync(
  latestImage: string | null,
  manifestImage: string | null,
  runningByImage: Record<string, number> | null,
) {
  const manifestMatchesLatest = !!latestImage && !!manifestImage &&
    latestImage === manifestImage;
  const totalRunning = runningByImage
    ? Object.values(runningByImage).reduce((a, b) => a + b, 0)
    : 0;
  const runningLatestCount = latestImage && runningByImage
    ? (runningByImage[latestImage] ?? 0)
    : 0;
  const allRunningLatest = totalRunning > 0 &&
    runningLatestCount === totalRunning;
  const inSync = Boolean(manifestMatchesLatest && allRunningLatest);
  return {
    manifestMatchesLatest,
    allRunningLatest,
    inSync,
    totalRunning,
    runningLatestCount,
  };
}

async function main() {
  const latest = await getLatestImage();
  const manifestImage = await getManifestImage();
  const runningByImage = await getRunningPodsByImage();

  const result = {
    latestImage: latest?.image ?? null,
    manifestImage: manifestImage ?? null,
    runningByImage: runningByImage ?? null,
    checks: computeSync(latest?.image ?? null, manifestImage, runningByImage),
  };

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  await main();
}
