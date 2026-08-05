import { createAccess } from "@usehercules/convex";
import type { MembershipStatus } from "@usehercules/convex";
import { components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";

// Wire Hercules managed access control into this Convex app. Call createAccess
// once here and export the access object plus the permission-aware builders.
//
// Use protectedQuery / protectedMutation / protectedAction for
// permission-enforced handlers. For unauthenticated public endpoints, import
// the raw query / mutation / action from ./_generated/server directly.
//
// Everything else is reached through `access`: in-handler authorization
// (access.hasPermissions / access.requirePermissions), resource nodes
// (access.resource.*), caller reads (access.me.*), mirror-table reads
// (access.tenants, access.roles, ...), and access.syncStatus.
export const access = createAccess({ query, mutation, action, components });

export const { protectedQuery, protectedMutation, protectedAction } = access;

// The access result the auth pages consume.
export type IamAccessEvaluationResult = {
  allowed: boolean;
  status: MembershipStatus | "missing";
  reason: string;
};

// getTenantAccessStatus - the reactive query the access boundary subscribes to.
// It returns the caller's membership status in the primary tenant straight from
// the mirror. Public (unauthenticated) so the boundary can render a signed-out
// state, so it uses the raw query builder.
export const getTenantAccessStatus = query({
  args: {},
  handler: async (ctx) => await access.me.accessStatus(ctx),
});

// evaluateAccess - run by the auth pages after sign-in and from "Check
// again". Performs deployment entry via access.enter (the tenant's access
// mode decides admit / pending / deny), then normalizes the outcome, using
// the mirror to distinguish an existing blocked/suspended/removed membership
// from a policy denial. Multi-tenant apps can add a tenant arg passed through
// to access.enter and access.me.accessStatus.
export const evaluateAccess = protectedAction({
  args: {},
  handler: async (ctx): Promise<IamAccessEvaluationResult> => {
    const entered = await access.enter(ctx);
    if (entered.status !== "denied") {
      return {
        allowed: entered.allowed,
        status: entered.status,
        reason:
          entered.status === "active" ? "membership_active" : entered.status,
      };
    }
    const status = await access.me.accessStatus(ctx);
    if (status.kind === "principal" && status.status !== "active") {
      return { allowed: false, status: status.status, reason: status.status };
    }
    return {
      allowed: false,
      status: "missing",
      reason: entered.reason ?? "membership_missing",
    };
  },
});
