import { ConvexError } from "convex/values";
import {
  getEffectivePermissions,
  listMyMemberships,
  type AccessMembership,
} from "./hercules";

export type OrgMembership = AccessMembership & {
  kind: "org";
  status: "active";
};

export function activeOrgMemberships(
  memberships: AccessMembership[],
): OrgMembership[] {
  return memberships.filter(
    (membership): membership is OrgMembership =>
      membership.kind === "org" && membership.status === "active",
  );
}

export function findActiveOrgMembership(
  memberships: AccessMembership[],
  scopeId: string,
): OrgMembership | undefined {
  return activeOrgMemberships(memberships).find(
    (membership) => membership.scopeId === scopeId,
  );
}

export async function requireActiveOrgMembership(
  ctx: Parameters<typeof listMyMemberships>[0],
  scopeId: string,
): Promise<OrgMembership> {
  const membership = findActiveOrgMembership(
    await listMyMemberships(ctx),
    scopeId,
  );
  if (!membership) {
    throw new ConvexError({ code: "ACCESS_DENIED", message: "Access denied" });
  }
  return membership;
}

export async function getOrgPermissions(
  ctx: Parameters<typeof getEffectivePermissions>[0],
  scopeId: string,
): Promise<string[]> {
  await requireActiveOrgMembership(ctx, scopeId);
  return await getEffectivePermissions(ctx, { scopeId });
}

export async function hasOrgPermission(
  ctx: Parameters<typeof getEffectivePermissions>[0],
  scopeId: string,
  permission: string,
): Promise<boolean> {
  const permissions = await getOrgPermissions(ctx, scopeId);
  return permissions.includes(permission);
}
