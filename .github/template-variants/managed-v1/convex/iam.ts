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
  getDeploymentEntryStatus: getDeploymentEntryStatusFromMirror,
  filterAuthorizedResources,
  listMyTenants,
  listMyRoles,
  getTenant,
  listTenantUsers,
  listTenantGroups,
  listTenantUserDirectory,
  getTenantUserDirectoryEntry,
  listGroupMembers,
  listUserGroups,
  listTenantRoles,
  getTenantRole,
  listTenantPermissions,
  getResourcePermissionOverrides,
  explainAccess,
  listDirectSubjectsForResource,
} = createIam({ query, mutation, action, components });

export const getDeploymentEntryStatus = publicQuery({
  args: {},
  handler: async (ctx) => await getDeploymentEntryStatusFromMirror(ctx),
});

export const enterDeployment = createDeploymentEntryAction({
  authenticatedAction,
  getDeploymentEntryStatus: getDeploymentEntryStatusFromMirror,
});

export type {
  IamResourceRef,
  AuthorizationDecision,
  DirectResourceSubject,
  ExplainAccessResult,
  ExplainAccessTarget,
  ResourcePermissionOverrideSubject,
  ResourcePermissionOverridesResult,
  ResourcePermissionOverrideTarget,
  TenantDetail,
  TenantGroup,
  TenantGroupsPage,
  TenantKind,
  TenantPermissionSummary,
  TenantRoleDetail,
  TenantRolePermission,
  TenantRoleSummary,
  TenantSummary,
  TenantUser,
  TenantUserDirectoryEntry,
  TenantUserDirectoryPage,
  TenantUsersPage,
  RoleSummary,
} from "@usehercules/convex";
export {
  defaultTenant,
  tenantFromArg,
  tenantFromDefaultParentResource,
  tenantFromDefaultResource,
  tenantFromParentResource,
  tenantFromResource,
} from "@usehercules/convex";
