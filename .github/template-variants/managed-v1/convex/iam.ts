import { createIam } from "@usehercules/convex";
import { Hercules } from "@usehercules/sdk";
import type { TenantEvaluateAccessResponse } from "@usehercules/sdk/resources/iam";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";

const DEFAULT_API_VERSION = "2025-12-09";
const HERCULES_API_KEY_ENV_VAR = "HERCULES_API_KEY";

export type IamAccessEvaluationResult = Pick<
  TenantEvaluateAccessResponse,
  "allowed" | "reason" | "status"
>;

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
        reason: "user_active",
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
    const result = await getIamClient().iam.tenants.evaluateAccess("root", {
      actor_token_identifier: tokenIdentifier,
    });
    return {
      allowed: result.allowed,
      reason: result.reason,
      status: result.status,
    };
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
  rootTenant,
  tenantFromArg,
  tenantFromRootParentResource,
  tenantFromRootResource,
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
