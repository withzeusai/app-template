import { defineVitestConfig } from "@usehercules/vite-tanstack/vitest";

// Two projects: "convex" (edge-runtime with convex-test) and "frontend"
// (jsdom with Testing Library). Keep tests hermetic: no real deployments or
// network calls.
export default defineVitestConfig();
