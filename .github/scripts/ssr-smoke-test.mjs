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

// `src/server.ts` wraps Start's handler, and what it adds only happens when
// the Worker runs that entry. This route throws outside the router, which
// Start answers with JSON and the entry turns into an HTML page for a browser.
const CRASH_ROUTE_PATH = "/ci-ssr-smoke-crash";
const CRASH_ROUTE_FILE = path.join("src", "routes", "ci-ssr-smoke-crash.tsx");
const CRASH_ROUTE_SOURCE = `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("${CRASH_ROUTE_PATH}")({
  server: {
    handlers: {
      GET: () => {
        throw new Error("ci-ssr-smoke-crash");
      },
    },
  },
});
`;

// Text that only appears when a render failed: the route error boundary's
// heading (src/components/route-error.tsx) and the message of the crash this
// check was added for.
const FAILURE_MARKERS = ["Something went wrong", "isDehydrated"];

// `getRouter()` refuses to start in production without a Convex URL. The
// check needs no backend, so any URL works: nothing on the pages it requests
// talks to Convex.
const PLACEHOLDER_CONVEX_URL = "https://ci-ssr-smoke.convex.cloud";

// `status` is the exact status a page must answer with; without it, any
// status below 500 passes.
const PAGES = [
  { path: "/", requiredText: [] },
  { path: SMOKE_ROUTE_PATH, requiredText: [SMOKE_MARKER] },
  { path: "/favicon.ico", status: 200, requiredText: [] },
  {
    path: "/ci-ssr-smoke-missing-page",
    status: 404,
    requiredText: ['<meta name="robots" content="noindex"'],
  },
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

async function checkPage({ path: pagePath, status, requiredText }) {
  const response = await fetch(new URL(pagePath, BASE_URL), {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const html = await response.text();
  const problems = [];

  if (
    status !== undefined ? response.status !== status : response.status >= 500
  ) {
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

// Checks on responses rather than page content: the error page
// `src/server.ts` serves a browser in place of Start's JSON (JSON when the
// Worker does not run that entry), and the 405 the auth routes answer for
// methods other than GET and HEAD.
const RESPONSE_CHECKS = [
  {
    path: CRASH_ROUTE_PATH,
    method: "GET",
    accept: "text/html",
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  },
  {
    path: "/auth/sign-in",
    method: "POST",
    status: 405,
    headers: { allow: "GET, HEAD" },
  },
];

async function checkResponse({
  path: pagePath,
  method,
  accept,
  status,
  headers,
}) {
  const response = await fetch(new URL(pagePath, BASE_URL), {
    method,
    headers: accept === undefined ? {} : { accept },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const html = await response.text();
  const problems = [];

  if (response.status !== status) problems.push(`status ${response.status}`);
  for (const [name, value] of Object.entries(headers)) {
    const actual = response.headers.get(name);
    if (actual !== value) problems.push(`${name}: ${actual ?? "missing"}`);
  }

  return {
    pagePath: `${method} ${pagePath}`,
    status: response.status,
    problems,
    html,
  };
}

async function main() {
  const appDir = readAppDir(process.argv.slice(2));
  const routeFiles = [
    [path.join(appDir, SMOKE_ROUTE_FILE), SMOKE_ROUTE_SOURCE],
    [path.join(appDir, CRASH_ROUTE_FILE), CRASH_ROUTE_SOURCE],
  ];
  const env = {
    ...process.env,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || PLACEHOLDER_CONVEX_URL,
  };
  let preview;

  for (const [file, source] of routeFiles) await writeFile(file, source);
  try {
    await run("pnpm", ["build"], { cwd: appDir, env });

    preview = startPreview(appDir, env);
    await waitForServer(preview);

    const results = [];
    for (const page of PAGES) results.push(await checkPage(page));
    for (const check of RESPONSE_CHECKS) {
      results.push(await checkResponse(check));
    }

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
    for (const [file] of routeFiles) await rm(file, { force: true });
  }
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLine) {
  await main();
}
