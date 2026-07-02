import { createAccess } from "@usehercules/convex";
import type { MembershipStatus } from "@usehercules/convex";
import { components } from "./_generated/api.js";
import {
  action as rawAction,
  mutation as rawMutation,
  query as rawQuery,
} from "./_generated/server.js";

// Wire Hercules managed access control into this Convex app. Call createAccess
// once here and re-export the builders and helpers the rest of the app uses.
const access = createAccess({
  query: rawQuery,
  mutation: rawMutation,
  action: rawAction,
  components,
});

export const {
  // Auth-aware builders. They require a verified identity and, when the
  // definition includes { permission, tenant?, resource? }, enforce that
  // permission before the handler runs.
  protectedQuery: query,
  protectedMutation: mutation,
  protectedAction: action,
  // In-handler authorization: hasPermissions returns a boolean,
  // requirePermissions throws.
  hasPermissions,
  requirePermissions,
  // Component-owned resource nodes. The app owns their lifecycle through
  // resource.write / resource.delete and reads them with resource.get /
  // resource.list, which can filter by a permission.
  resource,
} = access;

// Raw builders, no auth. Use these only for explicitly public functions.
export const publicQuery = rawQuery;
export const publicMutation = rawMutation;
export const publicAction = rawAction;

// The access result the auth pages consume. It is derived entirely from the
// local access mirror, so it stays in sync with control-plane changes as they
// project into Convex.
export type IamAccessEvaluationResult = {
  allowed: boolean;
  status: MembershipStatus | "missing";
  reason: string;
};

// getTenantAccessStatus — the reactive query the access boundary subscribes to.
// It returns the caller's membership status in the primary tenant straight from
// the mirror.
export const getTenantAccessStatus = publicQuery({
  args: {},
  handler: async (ctx) => await access.me.accessStatus(ctx),
});

// evaluateAccess — an imperative access re-check used by the auth pages. It
// reads the same mirror and normalizes it into an allowed/status result.
export const evaluateAccess = action({
  args: {},
  handler: async (ctx): Promise<IamAccessEvaluationResult> => {
    const status = await access.me.accessStatus(ctx);
    if (status.kind === "principal") {
      return {
        allowed: status.status === "active",
        status: status.status,
        reason: status.status === "active" ? "membership_active" : status.status,
      };
    }
    return { allowed: false, status: "missing", reason: status.reason };
  },
});
