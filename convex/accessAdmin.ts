"use node";

import { createAccessAdminActions } from "@usehercules/convex/access-admin";
import { accessAction, authenticatedAction } from "./access";

export const {
  createScope,
  archiveScope,
  assignRole,
  removeRole,
  createOrgCustomRole,
  updateRolePermissions,
  setUserExceptions,
  createResourceGrant,
  revokeResourceGrant,
  setGrantExpiry,
  setRoleOverride,
} = createAccessAdminActions({ accessAction, authenticatedAction });
