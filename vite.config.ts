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
    ssr: {
      optimizeDeps: {
        include: [
          "@tanstack/react-query",
          "@convex-dev/react-query",
          "convex/browser",
          "convex/react",
        ],
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
