import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  cachedEnvironments,
  currentEnvironments,
  rebundleLines,
} from "./warm-vite-cache.mjs";

const roots = [];

after(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function viteDir(layout) {
  const root = await mkdtemp(path.join(os.tmpdir(), "vite-cache-"));
  roots.push(root);
  for (const [dir, finished] of Object.entries(layout)) {
    await mkdir(path.join(root, dir), { recursive: true });
    if (finished) await writeFile(path.join(root, dir, "_metadata.json"), "{}");
  }
  return root;
}

test("names the environments with a finished cache", async () => {
  const dir = await viteDir({
    deps: true,
    deps_ssr: true,
    deps_temp_6971e422: true,
    deps_ssr_temp_cc04adfc: true,
    deps_worker: false,
  });
  assert.deepEqual(await cachedEnvironments(dir), ["client", "ssr"]);
});

test("finds no environments without a cache directory", async () => {
  assert.deepEqual(
    await cachedEnvironments(path.join(os.tmpdir(), "no-such-vite-cache")),
    [],
  );
});

test("reads which caches Vite found current, colored or not", () => {
  const log = [
    "2026-11-06T00:02:34.496Z vite:deps (ssr) Hash is consistent. Skipping. Use --force to override.",
    "\x1b[36m2026-11-06T00:02:36.571Z vite:deps\x1b[0m (client) Hash is consistent. Skipping. Use --force to override.",
  ].join("\n");
  assert.deepEqual(currentEnvironments(log), ["ssr", "client"]);
  assert.deepEqual(rebundleLines(log), []);
});

test("reports a cache Vite discarded or bundled again", () => {
  const log = [
    "10:00:00 AM [vite] (ssr) Re-optimizing dependencies because vite config has changed",
    "2026-11-06T00:02:35.648Z vite:deps Dependencies bundled in 865.41ms",
    "2026-11-06T00:02:35.651Z vite:deps dependencies optimized",
  ].join("\n");
  assert.deepEqual(rebundleLines(log), [
    "10:00:00 AM [vite] (ssr) Re-optimizing dependencies because vite config has changed",
    "2026-11-06T00:02:35.648Z vite:deps Dependencies bundled in 865.41ms",
  ]);
});
