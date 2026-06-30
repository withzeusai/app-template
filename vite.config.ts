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
    devtools(),
    tailwindcss(),
    hercules(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
  ],
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
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
