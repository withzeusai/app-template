import type { DocumentId } from "@usehercules/olympus/server";
import { mutation, query } from "./.olympus/server";

// Check each independently grantable operation against the selected organization.
export const access = query(async (ctx) => {
  const org = await ctx.auth.organization();
  if (!org) return { view: false, run: false };
  return {
    view: await ctx.auth.can(org, "reports.view"),
    run: await ctx.auth.can(org, "reports.execute"),
  };
});

export const recent = query(async (ctx) => {
  const org = await ctx.auth.organization();
  if (!org) throw new Error("Choose an organization.");
  return ctx.db
    .query("reports")
    .index("by_org", (q) =>
      q.eq("orgId", org as DocumentId<"iam.organizations">),
    )
    .order("desc")
    .take(10);
});

// Record the caller's current access in this organization. The table's create
// rule enforces reports.execute even if the caller invokes the mutation directly.
export const run = mutation(async (ctx) => {
  const user = await ctx.auth.user();
  const org = await ctx.auth.organization();
  if (!user || !org) throw new Error("Sign in and choose an organization.");
  return ctx.db.insert("reports", {
    orgId: org as DocumentId<"iam.organizations">,
    author: user._id,
    couldViewReports: await ctx.auth.can(org, "reports.view"),
  });
});
