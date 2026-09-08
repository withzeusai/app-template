import convexPlugin from "@convex-dev/eslint-plugin";
import js from "@eslint/js";
import herculesPlugin from "@usehercules/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    ".output",
    ".tanstack",
    ".github",
    "**/_generated/*",
    "src/routeTree.gen.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
      convexPlugin.configs.recommended,
      herculesPlugin.configs.recommended,
    ],
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-expect-error": true, "ts-nocheck": true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui components co-export their cva variant helpers by design.
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // TanStack Router route files must export `Route` alongside their
    // component -- that is the framework contract, and the router plugin
    // handles Fast Refresh for them.
    files: ["src/routes/**", "src/router.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
