import { createAccessControl } from "@usehercules/convex";
import { components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";

export const {
  publicQuery,
  publicMutation,
  publicAction,
  authenticatedQuery,
  authenticatedMutation,
  authenticatedAction,
  accessQuery,
  accessMutation,
  accessAction,
} = createAccessControl({
  query,
  mutation,
  action,
  components,
});
