"use node";

import { createAccessUserActions } from "@usehercules/convex/access-admin";
import { authenticatedAction } from "./hercules";

export const {
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
  revokeResourceGrant,
  setGrantExpiry,
  setRoleOverride,
} = createAccessUserActions({ authenticatedAction });
