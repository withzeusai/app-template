import { defineVitestConfig } from "@usehercules/vite-tanstack/vitest";

// Unit-test config for this app. Two projects run in one command:
//   - "convex"   backend functions, run in the edge-runtime via convex-test
//   - "frontend" React components and logic, run in jsdom via Testing Library
//
// Keep tests hermetic: use convex-test and mocks instead of real deployments,
// network calls, or environment-dependent behavior.
export default defineVitestConfig();
