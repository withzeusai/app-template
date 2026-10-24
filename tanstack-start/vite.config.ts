import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
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
 * Every package the template ships, bundled up front in both environments so
 * Vite never re-optimizes them mid-session. On the server a re-optimization
 * loads a second React copy and breaks SSR until a restart. The optimizer
 * only finds a package the first time a page that imports it renders, so the
 * list covers them all, not only the ones the starter page uses: the first
 * route that adds a form or an animation would otherwise trigger it. It
 * matches what `node_modules/.vite/deps_ssr/_metadata.json` holds after a full
 * build, minus the React entries Start adds itself.
 */
const PREBUNDLED_PACKAGES = [
  "@tanstack/react-query",
  "@tanstack/react-router-ssr-query",
  "@tanstack/react-router > @tanstack/react-store",
  "@convex-dev/react-query",
  "@usehercules/auth-tanstack",
  "@usehercules/auth-tanstack/client",
  "@usehercules/auth-tanstack/convex",
  "convex/react",
  "convex/server",
  "convex/values",
  "@hookform/resolvers/zod",
  ...baseUiEntries(),
  "@shadcn/react/message-scroller",
  "class-variance-authority",
  "clsx",
  "cmdk",
  "date-fns",
  "embla-carousel-react",
  "input-otp",
  "lucide-react",
  "motion/react",
  "react-day-picker",
  "react-hook-form",
  "react-resizable-panels",
  "recharts",
  "sonner",
  "tailwind-merge",
  "use-debounce",
  "zod",
];

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
  // The browser bundle gets the same list: without it each package the app
  // starts using triggers a re-bundle and a full reload of the preview.
  optimizeDeps: {
    include: PREBUNDLED_PACKAGES,
  },
  environments: {
    // "ssr" is the Worker environment (see `viteEnvironment` above). TanStack
    // Start already includes React here and must keep its router packages out.
    ssr: {
      optimizeDeps: {
        include: [...PREBUNDLED_PACKAGES, "convex/browser"],
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
