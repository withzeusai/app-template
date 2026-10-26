import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    HERCULES_OIDC_AUTHORITY: v.string(),
    HERCULES_OIDC_CLIENT_ID: v.string(),
    HERCULES_API_KEY: v.string(),
  },
});

export default app;
