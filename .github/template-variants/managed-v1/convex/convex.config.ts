import { defineApp } from "convex/server";
import hercules from "@usehercules/convex/convex.config.js";

const app = defineApp();

app.use(hercules, { name: "hercules" });

export default app;
