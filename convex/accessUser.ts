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
  replaceMemberRoles,
  createOrgCustomRole,
  updateRolePermissions,
  setUserExceptions,
  createResourceGrant,
  replaceResourceGrants,
  createResourceInvitation,
  setResourcePermissionRule,
  setResourcePermissionRules,
  revokeResourceGrant,
  setGrantExpiry,
  setRoleOverride,
  addMember,
  setMemberStatus,
  removeMember,
  approveMember,
  upsertAdmissionRule,
  archiveAdmissionRule,
  setAccountEntryMode,
  createGroup,
  renameGroup,
  archiveGroup,
  listGroups,
  addGroupMember,
  removeGroupMember,
  listResourceInvitations,
  getRoleOverrides,
  getUserExceptions,
} = createAccessUserActions({
  authenticatedAction,
  getDeploymentEntryStatus,
});
