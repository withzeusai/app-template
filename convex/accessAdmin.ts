"use node";

import { createAccessAdminActions } from "@usehercules/convex/access-admin";
import { accessAction } from "./hercules";

export const {
  archiveScope,
  setDefaultRole,
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
