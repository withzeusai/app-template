"use node";

import { createAccessScope } from "@usehercules/convex/access-admin";
import type { ActionCtx } from "./_generated/server.js";

export type CreateOrgScopeArgs = {
  name: string;
  defaultRoleKey?: string;
  accountEntryMode?:
    | "open"
    | "allowlisted_only"
    | "invite_only"
    | "approval_required";
};

export async function createOrgScope(
  ctx: Pick<ActionCtx, "auth">,
  args: CreateOrgScopeArgs,
): Promise<{ accessScopeId: string }> {
  // Hercules derives the authenticated creator and makes them Owner. Do not
  // add a second self-grant after this call.
  const result = await createAccessScope(ctx, {
    name: args.name,
    defaultRoleKey: args.defaultRoleKey ?? "member",
    accountEntryMode: args.accountEntryMode ?? "allowlisted_only",
  });

  return { accessScopeId: result.accessScopeId };
}
