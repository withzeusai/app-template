import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

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
    alias: {
      "@/convex": path.resolve(import.meta.dirname, "./convex"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  environments: {
    // "ssr" is the Worker environment (see `viteEnvironment` above). Bundle
    // these up front so Vite never re-optimizes them mid-session, which would
    // load a second React copy and break SSR until a restart. TanStack Start
    // already includes React here and must keep its router packages out.
    //
    // The optimizer only scans from the Worker entry, so it finds a package
    // the first time a page that imports it renders. The list therefore
    // covers every package the template ships, not only the ones the starter
    // page uses: the first route that adds a form or an animation would
    // otherwise trigger that re-optimization. It matches what
    // `node_modules/.vite/deps_ssr/_metadata.json` holds after a full build,
    // minus the React entries Start adds itself.
    ssr: {
      optimizeDeps: {
        include: [
          "@tanstack/react-query",
          "@tanstack/react-router-ssr-query",
          "@tanstack/react-router > @tanstack/react-store",
          "@convex-dev/react-query",
          "@usehercules/auth-tanstack",
          "@usehercules/auth-tanstack/client",
          "@usehercules/auth-tanstack/convex",
          "convex/browser",
          "convex/react",
          "convex/server",
          "convex/values",
          "@hookform/resolvers/zod",
          "class-variance-authority",
          "clsx",
          "cmdk",
          "date-fns",
          "embla-carousel-react",
          "input-otp",
          "lucide-react",
          "motion/react",
          "radix-ui",
          "react-day-picker",
          "react-hook-form",
          "react-resizable-panels",
          "recharts",
          "sonner",
          "tailwind-merge",
          "use-debounce",
          "vaul",
          "zod",
        ],
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
