import hercules from "@usehercules/convex/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

// The hercules IAM component verifies the signed projection-sync webhook inside
// its own runtime, and Convex isolates a component's env vars from the app, so
// the app declares HERCULES_SYNC_SECRET and binds it into the component.
const app = defineApp({ env: { HERCULES_SYNC_SECRET: v.string() } });

app.use(hercules, {
  name: "hercules",
  env: { HERCULES_SYNC_SECRET: app.env.HERCULES_SYNC_SECRET },
});

export default app;
