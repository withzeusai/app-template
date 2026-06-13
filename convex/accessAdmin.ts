"use node";

import { createAccessAdminActions } from "@usehercules/convex/access-admin";
import { internalAction } from "./_generated/server";

export const {
  archiveScope,
  setDefaultRole,
  createInvitation,
  revokeInvitation,
  assignRole,
  removeRole,
  createOrgCustomRole,
  updateRolePermissions,
  setUserExceptions,
  createResourceGrant,
  createResourceInvitation,
  setResourcePermissionRule,
  setResourcePermissionRules,
  revokeResourceGrant,
  setGrantExpiry,
  setRoleOverride,
} = createAccessAdminActions({ internalAction });
