import { createIam } from "@usehercules/convex";
import { Hercules } from "@usehercules/sdk";
import type { TenantEvaluateAccessResponse } from "@usehercules/sdk/resources/iam";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";

const DEFAULT_API_VERSION = "2025-12-09";
const HERCULES_API_KEY_ENV_VAR = "HERCULES_API_KEY";

type ActiveMirrorTenantAccessResult = {
  allowed: true;
  changed: false;
  reason: "existing_active";
  state_version: number;
  status: "active";
};

export type IamAccessEvaluationResult =
  | TenantEvaluateAccessResponse
  | ActiveMirrorTenantAccessResult;

let iamClient: Hercules | undefined;

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
  getTenantAccessStatus: getTenantAccessStatusFromMirror,
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

export const getTenantAccessStatus = publicQuery({
  args: {},
  handler: async (ctx) => await getTenantAccessStatusFromMirror(ctx),
});

export const evaluateAccess = authenticatedAction({
  args: {},
  handler: async (ctx): Promise<IamAccessEvaluationResult> => {
    const mirror = await getTenantAccessStatusFromMirror(ctx);
    if (mirror.kind === "principal" && mirror.status === "active") {
      return {
        allowed: true,
        changed: false,
        reason: "existing_active",
        state_version: mirror.stateVersion,
        status: "active",
      };
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      });
    }
    const tokenIdentifier = identity.tokenIdentifier;
    return await getIamClient().iam.tenants.evaluateAccess("default", {
      user_token_identifier: tokenIdentifier,
    });
  },
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

function getIamClient() {
  iamClient ??= createIamClient();
  return iamClient;
}

function createIamClient() {
  const apiKey = process.env[HERCULES_API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new Error(
      `${HERCULES_API_KEY_ENV_VAR} is required for Hercules IAM API calls.`,
    );
  }

  return new Hercules({
    apiKey,
    apiVersion: DEFAULT_API_VERSION,
  });
}
