import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Lint, type check, and build all pass when a server-rendered page crashes at
// render time, for example when two TanStack packages in the lockfile no
// longer agree on an internal API. This builds the app, serves it with
// `vite preview` (the Worker runtime the app deploys to), and requests real
// pages so such a crash fails CI.

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

// The template's own pages have no loader that reads TanStack Query, and the
// SSR query integration only runs its per-query code once a query enters the
// cache. So CI adds this route for the duration of the check: its loader
// fills the cache with `ensureQueryData` and its component reads the result,
// the same path an app route that loads Convex data takes. The query has its
// own `queryFn`, so no Convex backend is needed.
const SMOKE_ROUTE_PATH = "/ci-ssr-smoke";
const SMOKE_ROUTE_FILE = path.join("src", "routes", "ci-ssr-smoke.tsx");
const SMOKE_MARKER = "ci-ssr-smoke-rendered";
const SMOKE_ROUTE_SOURCE = `import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

const smokeQuery = queryOptions({
  queryKey: ["ci-ssr-smoke"],
  queryFn: () => Promise.resolve("${SMOKE_MARKER}"),
});

export const Route = createFileRoute("${SMOKE_ROUTE_PATH}")({
  loader: ({ context }) => context.queryClient.ensureQueryData(smokeQuery),
  component: SmokePage,
});

function SmokePage() {
  const { data } = useSuspenseQuery(smokeQuery);
  return <p>{data}</p>;
}
`;

// Text that only appears when a render failed: the route error boundary's
// heading (src/components/route-error.tsx) and the message of the crash this
// check was added for.
const FAILURE_MARKERS = ["Something went wrong", "isDehydrated"];

// `getRouter()` refuses to start in production without a Convex URL. The
// check needs no backend, so any URL works: nothing on the pages it requests
// talks to Convex.
const PLACEHOLDER_CONVEX_URL = "https://ci-ssr-smoke.convex.cloud";

const PAGES = [
  { path: "/", requiredText: [] },
  { path: SMOKE_ROUTE_PATH, requiredText: [SMOKE_MARKER] },
];

function readAppDir(argv) {
  const flagIndex = argv.indexOf("--app-dir");
  const appDir = argv[flagIndex + 1];

  if (flagIndex === -1 || !appDir) {
    throw new Error("Usage: ssr-smoke-test --app-dir <path>");
  }

  return path.resolve(appDir);
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

function startPreview(appDir, env) {
  const output = [];
  const args = [
    "exec",
    "vite",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORT),
    "--strictPort",
  ];
  const child = spawn("pnpm", args, {
    cwd: appDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.stderr.on("data", (chunk) => output.push(chunk));

  return {
    child,
    output: () => Buffer.concat(output).toString("utf8"),
    stop: () => {
      if (child.exitCode !== null) return;
      try {
        // Negative pid: the whole group, so the Worker runtime exits too.
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    },
  };
}

async function waitForServer(preview) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (preview.child.exitCode !== null) {
      throw new Error(
        `vite preview exited with ${preview.child.exitCode} before serving`,
      );
    }
    try {
      await fetch(BASE_URL, { signal: AbortSignal.timeout(2_000) });
      return;
    } catch {
      await delay(500);
    }
  }

  throw new Error(
    `vite preview did not answer within ${STARTUP_TIMEOUT_MS} ms`,
  );
}

async function checkPage({ path: pagePath, requiredText }) {
  const response = await fetch(new URL(pagePath, BASE_URL), {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const html = await response.text();
  const problems = [];

  if (response.status >= 500) {
    problems.push(`status ${response.status}`);
  }
  for (const marker of FAILURE_MARKERS) {
    if (html.includes(marker)) problems.push(`page contains "${marker}"`);
  }
  for (const text of requiredText) {
    if (!html.includes(text)) problems.push(`page is missing "${text}"`);
  }

  return { pagePath, status: response.status, problems, html };
}

async function main() {
  const appDir = readAppDir(process.argv.slice(2));
  const routeFile = path.join(appDir, SMOKE_ROUTE_FILE);
  const env = {
    ...process.env,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || PLACEHOLDER_CONVEX_URL,
  };
  let preview;

  await writeFile(routeFile, SMOKE_ROUTE_SOURCE);
  try {
    await run("pnpm", ["build"], { cwd: appDir, env });

    preview = startPreview(appDir, env);
    await waitForServer(preview);

    const results = [];
    for (const page of PAGES) results.push(await checkPage(page));

    let failed = false;
    for (const result of results) {
      if (result.problems.length === 0) {
        console.log(`ok   ${result.pagePath} (${result.status})`);
        continue;
      }
      failed = true;
      console.error(
        `FAIL ${result.pagePath} (${result.status}): ${result.problems.join(", ")}`,
      );
      console.error(result.html.slice(0, 4_000));
    }

    if (failed) {
      console.error("\nvite preview output:\n" + preview.output());
      process.exitCode = 1;
    }
  } finally {
    preview?.stop();
    await rm(routeFile, { force: true });
  }
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLine) {
  await main();
}
