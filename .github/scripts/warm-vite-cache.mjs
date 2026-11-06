import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, cp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Vite bundles an app's dependencies the first time its dev server starts and
// keeps them in node_modules/.vite. A new Hercules app pays for that on its
// first start, before the preview can render: about 1.4 s of the start on a
// fast laptop, more on a dev machine. This builds the cache in CI so it ships
// inside the template tarball.
//
// Vite reuses the cache only when its hash matches, and the hash includes the
// app's absolute path, its resolved aliases and its plugins. So the cache is
// built where dev machines keep the app, with the environment herculesd starts
// the dev server with, and then checked the way a machine uses it: a fresh
// copy of the template with the cache, installed and started, must find the
// cache current in every environment.

// herculesd's port and arguments (devServerArgs in hercules.app's
// herculesd/src/services/dev-server-health.ts). Neither is in the hash.
const PORT = 5173;
const DEV_SERVER_ARGS = [
  "vite",
  "--host",
  "0.0.0.0",
  "--port",
  String(PORT),
  "--strictPort",
];

// What the dev machine image sets (docker/dev-image.dockerfile in
// hercules.app). It turns on `@usehercules/vite-tanstack`'s dev machine
// settings, which change the plugins and so the hash.
const DEV_MACHINE_ENV = { HERCULES_DEV_MACHINE: "1" };

const CACHE_TIMEOUT_MS = 180_000;
const STOP_TIMEOUT_MS = 10_000;
const POLL_MS = 250;

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function cacheDirOf(appDir) {
  return path.join(appDir, "node_modules", ".vite");
}

/**
 * Environments with a finished cache in `viteDir`: `deps` holds the
 * browser's (`client`), `deps_<name>` another environment's. A run still in
 * progress writes to `deps_temp_<hash>` or `deps_<name>_temp_<hash>`.
 */
export async function cachedEnvironments(viteDir) {
  let entries;
  try {
    entries = await readdir(viteDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const names = [];
  for (const entry of entries) {
    const match = /^deps(?:_([A-Za-z]+))?$/.exec(entry.name);
    if (!entry.isDirectory() || !match) continue;
    if (await exists(path.join(viteDir, entry.name, "_metadata.json"))) {
      names.push(match[1] ?? "client");
    }
  }
  return names.sort();
}

function plain(log) {
  return log.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Environments whose cache Vite's `vite:deps` debug log reports as current. */
export function currentEnvironments(log) {
  return [...plain(log).matchAll(/\((\w+)\) Hash is consistent/g)].map(
    (match) => match[1],
  );
}

/** Lines showing Vite bundled the dependencies instead of reusing the cache. */
export function rebundleLines(log) {
  return plain(log)
    .split("\n")
    .filter(
      (line) =>
        line.includes("Re-optimizing dependencies because") ||
        line.includes("Dependencies bundled in"),
    )
    .map((line) => line.trim());
}

function includesAll(actual, expected) {
  return expected.every((name) => actual.includes(name));
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function startDevServer(appDir, extraEnv = {}) {
  const env = { ...process.env, ...DEV_MACHINE_ENV, ...extraEnv };
  // Dev machines leave it unset, and Vite hashes it.
  delete env.NODE_ENV;
  const output = [];
  const child = spawn("pnpm", DEV_SERVER_ARGS, {
    cwd: appDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.stderr.on("data", (chunk) => output.push(chunk));

  const signal = (name) => {
    try {
      // Negative pid: the whole group, so workerd exits too.
      process.kill(-child.pid, name);
    } catch {
      // Already gone.
    }
  };

  return {
    child,
    output: () => Buffer.concat(output).toString("utf8"),
    stop: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      signal("SIGTERM");
      const stopped = await Promise.race([
        exited.then(() => true),
        delay(STOP_TIMEOUT_MS, false),
      ]);
      if (!stopped) signal("SIGKILL");
    },
  };
}

async function waitFor(ready, server, description) {
  const deadline = Date.now() + CACHE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await ready()) return;
    if (server.child.exitCode !== null) {
      throw new Error(
        `The dev server exited with ${server.child.exitCode} before ${description}:\n${server.output()}`,
      );
    }
    await delay(POLL_MS);
  }
  throw new Error(`Timed out waiting for ${description}:\n${server.output()}`);
}

/** A fresh app at `appDir` from `templateDir`, the way herculesd creates one, installed. */
async function createApp(templateDir, appDir) {
  await rm(appDir, { recursive: true, force: true });
  await cp(templateDir, appDir, { recursive: true });
  await run("pnpm", ["install", "--frozen-lockfile"], { cwd: appDir });
}

/**
 * Builds Vite's dependency cache for the template at `templateDir` by
 * starting its dev server at `appDir`, copies it into the template, and
 * checks that a fresh app at `appDir` reuses it in every one of
 * `environments`.
 */
export async function warmViteCache({ templateDir, appDir, environments }) {
  await createApp(templateDir, appDir);
  const build = startDevServer(appDir);
  try {
    await waitFor(
      async () =>
        includesAll(await cachedEnvironments(cacheDirOf(appDir)), environments),
      build,
      `Vite's dependency cache for ${environments.join(", ")}`,
    );
  } finally {
    await build.stop();
  }

  await rm(cacheDirOf(templateDir), { recursive: true, force: true });
  await cp(cacheDirOf(appDir), cacheDirOf(templateDir), { recursive: true });

  await createApp(templateDir, appDir);
  const check = startDevServer(appDir, { DEBUG: "vite:deps" });
  const settled = () =>
    includesAll(currentEnvironments(check.output()), environments) ||
    rebundleLines(check.output()).length > 0;
  try {
    await waitFor(settled, check, "Vite to check the shipped cache");
  } finally {
    await check.stop();
  }
  const rebundled = rebundleLines(check.output());
  if (rebundled.length > 0) {
    throw new Error(
      `A fresh app did not reuse the cache:\n${rebundled.join("\n")}`,
    );
  }
}

function readArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const templateDir = value("--template-dir");
  const appDir = value("--app-dir");
  const environments = value("--environments");
  if (!templateDir || !appDir || !environments) {
    throw new Error(
      "Usage: warm-vite-cache --template-dir <path> --app-dir <path> --environments <a,b> [--best-effort]",
    );
  }
  return {
    templateDir: path.resolve(templateDir),
    appDir: path.resolve(appDir),
    environments: environments.split(",").filter(Boolean),
    bestEffort: argv.includes("--best-effort"),
  };
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLine) {
  const { bestEffort, ...options } = readArgs(process.argv.slice(2));
  try {
    await warmViteCache(options);
    console.log(
      `Shipping Vite's dependency cache for ${options.environments.join(", ")}`,
    );
  } catch (error) {
    if (!bestEffort) throw error;
    // A tarball without the cache works as before; only the first start is slower.
    await rm(cacheDirOf(options.templateDir), { recursive: true, force: true });
    console.log(
      `::warning::Shipping the template without Vite's dependency cache: ${error.message}`,
    );
  }
}
