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
  hasPermission,
  requirePermission,
  requireAnyPermission,
  getEffectivePermissions,
  listMyMemberships,
  listMyRoles,
} = createAccessControl({
  query,
  mutation,
  action,
  components,
});

export type {
  AccessResourceRef,
  Membership as AccessMembership,
  RoleSummary as AccessRoleSummary,
} from "@usehercules/convex";
export { scopeFromArg, scopeFromResource } from "@usehercules/convex";
