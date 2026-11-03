import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit-test config for this app. Two projects run in one command:
//   - "backend"  backend functions, run on a real olympus-server through
//                olympus/test: each test deploys backend/ to a new database
//   - "frontend" React components and logic, run in jsdom via Testing Library
//
// Keep tests hermetic: the backend tests' server is local and started for the run;
// use mocks instead of real deployments, network calls, or environment-dependent
// behavior.
export default defineConfig({
  resolve: {
    alias: {
      "@/backend": path.resolve(import.meta.dirname, "./backend"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    passWithNoTests: true,
    // Restore Vitest mocks before each test to reduce state leakage.
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "backend",
          environment: "node",
          include: ["backend/**/*.test.{ts,js}"],
          globalSetup: ["@usehercules/olympus/test/setup"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/vitest.setup.ts"],
        },
      },
    ],
  },
});
