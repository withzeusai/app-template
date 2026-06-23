import { registerIamRoutes } from "@usehercules/convex/http";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api.js";
import { httpAction } from "./_generated/server.js";

const http = httpRouter();

registerIamRoutes(http, {
  httpAction,
  components,
});

export default http;
