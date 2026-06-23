import { createIam } from "@usehercules/convex";
import { createDeploymentEntryAction } from "@usehercules/convex/iam-management";
import { components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";

export const {
  publicQuery,
  publicMutation,
  publicAction,
  authenticatedQuery,
  authenticatedMutation,
  authenticatedAction,
  iamQuery,
  iamMutation,
  iamAction,
  hasPermission,
  requirePermission,
  requireAnyPermission,
  getEffectivePermissions,
  checkPermissions,
  getCurrentHerculesAuthUserId,
  getDeploymentEntryStatus,
  filterAuthorizedResources,
  listMyMemberships,
  listMyRoles,
  listScopeMembers,
  listScopeMemberDirectory,
  getScopeMemberDirectoryEntry,
  listScopeRoles,
  listScopePermissions,
  listDirectSubjectsForResource,
} = createIam({ query, mutation, action, components });

export const enterDeployment = createDeploymentEntryAction({
  authenticatedAction,
  getDeploymentEntryStatus,
});

export type {
  IamResourceRef,
  AuthorizationDecision,
  DirectResourceSubject,
  Membership,
  RoleSummary,
  ScopeMember,
  ScopeMemberDirectoryEntry,
  ScopeMemberDirectoryPage,
  ScopePermissionSummary,
  ScopeRoleSummary,
} from "@usehercules/convex";
export {
  scopeFromArg,
  scopeFromDefaultParentResource,
  scopeFromDefaultResource,
  scopeFromParentResource,
  scopeFromResource,
} from "@usehercules/convex";
