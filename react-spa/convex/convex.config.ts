import { defineApp } from "convex/server";
import { v } from "convex/values";

// Environment variables the backend needs, read from the typed `env` in
// `_generated/server`. A deploy fails until every required one is set, so
// declare a secret the app owner adds later with `v.optional(...)`.
const app = defineApp({
  env: {
    HERCULES_OIDC_AUTHORITY: v.string(),
    HERCULES_OIDC_CLIENT_ID: v.string(),
  },
});

export default app;
