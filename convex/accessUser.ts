"use node";

import { createAccessUserActions } from "@usehercules/convex/access-admin";
import { authenticatedAction, getDeploymentEntryStatus } from "./hercules";

export const {
  enterDeployment,
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
} = createAccessUserActions({
  authenticatedAction,
  getDeploymentEntryStatus,
});
