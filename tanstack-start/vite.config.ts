import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Base UI publishes one entry point per component (`@base-ui/react/dialog`,
 * ...), and the optimizer treats each as its own package. Take them all from
 * its export map, so a component the app starts using later is covered too.
 * `internals/` holds hooks the components import from inside the package.
 */
function baseUiEntries(): string[] {
  const { exports } = createRequire(import.meta.url)(
    "@base-ui/react/package.json",
  ) as { exports: Record<string, unknown> };
  return Object.keys(exports)
    .filter(
      (key) => key !== "./package.json" && !key.startsWith("./internals/"),
    )
    .map((key) =>
      key === "." ? "@base-ui/react" : `@base-ui/react/${key.slice(2)}`,
    );
}

/**
 * Entries a package name does not cover, bundled up front on top of the app's
 * dependencies (see `prebundleDependencies`): template packages imported by
 * subpath, and a dependency of TanStack Router, which loads from source. Each
 * is kept only when `package.json` declares its package.
 */
const PREBUNDLED_ENTRIES = [
  "@tanstack/react-router > @tanstack/react-store",
  "@usehercules/auth-tanstack/client",
  "@usehercules/auth-tanstack/convex",
  "convex/react",
  "convex/server",
  "convex/values",
  "@hookform/resolvers/zod",
  ...baseUiEntries(),
  "@shadcn/react/message-scroller",
  "motion/react",
];
const SSR_PREBUNDLED_ENTRIES = ["convex/browser"];

// Vite and TanStack Start already include React, and Start loads its own and
// the router's packages from source. Start also excludes those, and the plugin
// leaves out anything a plugin excludes.
const NEVER_PREBUNDLED = new Set([
  "react",
  "react-dom",
  "@tanstack/react-start",
  "@tanstack/react-router",
  "@tanstack/react-router-devtools",
]);
// The optimizer cannot bundle a `.node` binary, and one failing entry fails
// the whole run.
const NATIVE_ADDON_LOADERS = new Set([
  "bindings",
  "nan",
  "node-addon-api",
  "node-gyp-build",
  "node-pre-gyp",
  "@mapbox/node-pre-gyp",
  "prebuild-install",
]);
const PLATFORM_PACKAGE =
  /-(?:darwin|linux|win32|freebsd|android)-(?:x64|arm64|arm|ia32)\b/;
const LOCKFILES = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
];

type Manifest = Record<string, unknown> & {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

function readManifest(file: string): Manifest | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Manifest;
  } catch {
    return undefined;
  }
}

function packageNameOf(entry: string): string {
  const parts = entry.split(">")[0]!.trim().split("/");
  return entry.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

function exportTargets(target: unknown): string[] {
  if (typeof target === "string") return [target];
  if (Array.isArray(target)) return target.flatMap(exportTargets);
  if (target && typeof target === "object") {
    return Object.values(target).flatMap(exportTargets);
  }
  return [];
}

function isJsEntry(file: string): boolean {
  return /\.[cm]?[jt]s$/.test(file) && !/\.d\.[cm]?ts$/.test(file);
}

/** Whether `import "name"` loads JavaScript, not CSS, types, or nothing. */
function hasJsRootEntry(manifest: Manifest, packageDir: string): boolean {
  const { exports } = manifest;
  if (exports && typeof exports === "object" && !Array.isArray(exports)) {
    const map = exports as Record<string, unknown>;
    const isSubpathMap = Object.keys(map).some((key) => key.startsWith("."));
    return exportTargets(isSubpathMap ? map["."] : map).some(isJsEntry);
  }
  if (exports) return exportTargets(exports).some(isJsEntry);
  for (const field of [manifest.module, manifest.main]) {
    if (typeof field !== "string" || field === "") continue;
    return isJsEntry(field) || path.extname(field) === "";
  }
  if (typeof manifest.browser === "string") return isJsEntry(manifest.browser);
  return existsSync(path.join(packageDir, "index.js"));
}

function hasNativeAddon(manifest: Manifest): boolean {
  if (manifest.gypfile === true || manifest.binary !== undefined) return true;
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ].some(
    (name) => NATIVE_ADDON_LOADERS.has(name) || PLATFORM_PACKAGE.test(name),
  );
}

/**
 * The installed runtime `dependencies` the optimizer can bundle. One that is
 * declared but not linked yet is left out until it is.
 */
function dependenciesToPrebundle(root: string): string[] {
  const pkg = readManifest(path.join(root, "package.json"));
  return Object.keys(pkg?.dependencies ?? {})
    .sort()
    .filter((name) => {
      if (NEVER_PREBUNDLED.has(name) || name.startsWith("@types/")) {
        return false;
      }
      const packageDir = path.join(root, "node_modules", name);
      const manifest = readManifest(path.join(packageDir, "package.json"));
      return (
        !!manifest &&
        hasJsRootEntry(manifest, packageDir) &&
        !hasNativeAddon(manifest)
      );
    });
}

/**
 * Restarts the dev server once the dependencies it would bundle differ from
 * the ones it started with.
 */
function restartOnDependencyChange(
  server: ViteDevServer,
  root: string,
  started: string[],
): void {
  const files = ["package.json", ...LOCKFILES].map((f) => path.join(root, f));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let polls = 0;
  let restarting = false;

  const check = () => {
    if (restarting) return;
    if (dependenciesToPrebundle(root).join("\n") !== started.join("\n")) {
      restarting = true;
      server.config.logger.info(
        "[hercules] dependencies changed; restarting the dev server to pre-bundle them",
        { timestamp: true },
      );
      void server.restart();
      return;
    }
    // pnpm can write package.json before it links the new package.
    const declared = readManifest(files[0]!)?.dependencies ?? {};
    const pending = Object.keys(declared).some(
      (name) =>
        !existsSync(path.join(root, "node_modules", name, "package.json")),
    );
    if (pending && polls++ < 60) timer = setTimeout(check, 1000);
  };

  const schedule = (file: string) => {
    if (!files.includes(file)) return;
    polls = 0;
    clearTimeout(timer);
    timer = setTimeout(check, 1000);
  };
  server.watcher.add(files);
  server.watcher.on("add", schedule);
  server.watcher.on("change", schedule);
  server.httpServer?.once("close", () => clearTimeout(timer));
}

/**
 * Bundles the app's dependencies up front in the browser and the Worker
 * (`ssr`), so Vite never discovers a package mid-session.
 *
 * A package discovered while the app runs makes Vite bundle the dependencies
 * again. In the browser that changes their version hash: modules still
 * fetched with the old one fail with 504 "Outdated Optimize Dep" ("Failed to
 * fetch dynamically imported module" for a lazily loaded route), then the
 * page reloads. In the Worker it can load a second React copy and break SSR
 * until a restart. So every runtime dependency in `package.json` is bundled
 * at startup (minus CSS or types only packages, native addons, and anything a
 * plugin excludes), the Worker scans all of `src` rather than only the server
 * entries, and the dev server restarts when the dependencies change, so a
 * package the agent installs is bundled before any code imports it.
 */
function prebundleDependencies(): Plugin {
  const root = import.meta.dirname;
  let dependencies: string[] | undefined;
  const configured = () => (dependencies ??= dependenciesToPrebundle(root));

  return {
    name: "prebundle-dependencies",
    apply: "serve",
    // After TanStack Start and the Cloudflare plugin, so their excludes are known.
    enforce: "post",
    configEnvironment(name, config) {
      if (name !== "client" && name !== "ssr") return;
      const pkg = readManifest(path.join(root, "package.json"));
      const declared = new Set([
        ...Object.keys(pkg?.dependencies ?? {}),
        ...Object.keys(pkg?.devDependencies ?? {}),
      ]);
      const entries = [
        ...PREBUNDLED_ENTRIES,
        ...(name === "ssr" ? SSR_PREBUNDLED_ENTRIES : []),
      ].filter((entry) => declared.has(packageNameOf(entry)));
      const excluded = new Set(config.optimizeDeps?.exclude ?? []);
      const include = [...configured(), ...entries].filter(
        (entry) => !excluded.has(entry) && !excluded.has(packageNameOf(entry)),
      );
      if (name === "client") return { optimizeDeps: { include } };
      return {
        optimizeDeps: {
          include,
          entries: [
            "src/**/*.{js,jsx,ts,tsx,mjs,mts}",
            "!src/**/*.d.ts",
            "!src/**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts}",
          ],
        },
      };
    },
    configureServer(server) {
      restartOnDependencyChange(server, root, configured());
    },
  };
}

/**
 * Holds page requests while the server program reloads, then lets one through
 * ahead of the rest.
 *
 * A change that needs a full reload (a moved route file, a regenerated route
 * tree) makes Vite reload the browser and the Worker program together. The
 * Worker re-evaluates its modules on the next request, and requests that
 * arrive while that is under way see half-initialized modules: the render
 * fails once with errors such as "Invalid hook call" or "is not a function",
 * then the next request succeeds. So page requests wait until the file changes
 * go quiet, the first one warms the program alone, and the others follow.
 * A request already rendering when the reload starts can still fail.
 */
function holdPagesDuringReload(): Plugin {
  const QUIET_MS = 500;
  // Below the 5 s navigation timeout of the screenshot browser.
  const MAX_HOLD_MS = 3000;
  let lastChangeAt = 0;
  let warm = true;
  let warming = false;
  const waiting: Array<() => void> = [];

  return {
    name: "hold-pages-during-reload",
    apply: "serve",
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const releaseAll = () => {
        warm = true;
        warming = false;
        for (const proceed of waiting.splice(0)) proceed();
      };

      const pump = () => {
        timer = undefined;
        if (warm || warming || waiting.length === 0) return;
        const quietFor = Date.now() - lastChangeAt;
        if (quietFor < QUIET_MS) {
          timer = setTimeout(pump, QUIET_MS - quietFor);
          return;
        }
        // The first request re-evaluates the program by itself.
        warming = true;
        waiting.shift()?.();
      };

      const touch = () => {
        lastChangeAt = Date.now();
        warm = false;
      };
      server.watcher.on("all", touch);
      const hot = server.environments.ssr?.hot;
      if (hot) {
        const send = hot.send.bind(hot);
        hot.send = ((...args: Parameters<typeof send>) => {
          touch();
          return send(...args);
        }) as typeof hot.send;
      }

      server.middlewares.use((req, res, next) => {
        const isPage =
          req.method === "GET" &&
          (req.headers.accept ?? "").includes("text/html");
        if (!isPage || warm) return next();

        let released = false;
        const proceed = () => {
          if (released) return;
          released = true;
          clearTimeout(giveUp);
          if (warming && !warm) {
            // This is the warming request: the rest follow once it is done,
            // unless the files changed again while it ran.
            const startedAt = Date.now();
            const done = () => {
              if (lastChangeAt > startedAt) {
                warming = false;
                pump();
              } else {
                releaseAll();
              }
            };
            res.once("finish", done);
            res.once("close", done);
          }
          next();
        };
        // Never hold a request for long: a stuck warm-up must not hang the app.
        const giveUp = setTimeout(() => {
          const index = waiting.indexOf(proceed);
          if (index !== -1) waiting.splice(index, 1);
          released = true;
          next();
        }, MAX_HOLD_MS);
        waiting.push(proceed);
        if (timer === undefined) pump();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    holdPagesDuringReload(),
    prebundleDependencies(),
    // Server logs already reach the terminal; piping them into the browser
    // (and prefixing every log) would print each line twice.
    devtools({
      consolePiping: { enabled: false },
      enhancedLogs: { enabled: false },
    }),
    tailwindcss(),
    hercules(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
  ],
  resolve: {
    // `@/` and `@/convex/` come from the `paths` in tsconfig.json.
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
