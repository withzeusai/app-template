"use node";

import { createAccessScope } from "@usehercules/convex/access-admin";
import type { ActionCtx } from "./_generated/server.js";

export type CreateOrgScopeArgs = {
  name: string;
  defaultRoleKey?: string;
  accountEntryMode?: "open" | "allowlisted_only";
};

export async function createOrgScope(
  ctx: Pick<ActionCtx, "auth">,
  args: CreateOrgScopeArgs,
): Promise<{ accessScopeId: string; accessScopeAppId?: string }> {
  const result = await createAccessScope(ctx, {
    name: args.name,
    defaultRoleKey: args.defaultRoleKey ?? "member",
    accountEntryMode: args.accountEntryMode ?? "allowlisted_only",
  });

  return {
    accessScopeId: result.accessScopeId,
    accessScopeAppId: result.accessScopeAppId,
  };
}
