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
} = createAccessControl({ query, mutation, action, components });

export type {
  AccessResourceRef,
  AuthorizationDecision as AccessAuthorizationDecision,
  DirectResourceSubject as AccessDirectResourceSubject,
  Membership as AccessMembership,
  RoleSummary as AccessRoleSummary,
  ScopeMember as AccessScopeMember,
  ScopeMemberDirectoryEntry as AccessScopeMemberDirectoryEntry,
  ScopeMemberDirectoryPage as AccessScopeMemberDirectoryPage,
  ScopeRoleSummary as AccessScopeRoleSummary,
  ScopePermissionSummary as AccessScopePermissionSummary,
} from "@usehercules/convex";
export {
  scopeFromArg,
  scopeFromDefaultParentResource,
  scopeFromDefaultResource,
  scopeFromParentResource,
  scopeFromResource,
} from "@usehercules/convex";
