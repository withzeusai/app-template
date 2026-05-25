"use node";

import { createAccessAdminActions } from "@usehercules/convex/access-admin";
import { accessAction } from "./access";

export const {
  assignRole,
  removeRole,
  createOrgCustomRole,
  updateRolePermissions,
  setUserExceptions,
  createResourceGrant,
  revokeResourceGrant,
  setGrantExpiry,
  setRoleOverride,
} = createAccessAdminActions({ accessAction });
