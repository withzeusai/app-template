import type {
  DirectoryEdit,
  DirectoryPagination,
  GrantLookup,
} from "@usehercules/olympus/server";
import { mutation, query } from "./.olympus/server";

export const viewer = query(async (ctx) => {
  const user = await ctx.auth.user();
  return user ? { id: user._id } : null;
});

export const organizations = query((ctx, page: DirectoryPagination) =>
  ctx.directory.read({ kind: "organizations" }, page),
);

export const sources = query(
  (ctx, { org, ...page }: DirectoryPagination & { org: string }) =>
    ctx.directory.read({ kind: "sources", org }, page),
);

export const group = query(
  (ctx, { org, group }: { org: string; group: string }) =>
    ctx.directory.read({ kind: "group", org, group }),
);

export const preview = query((ctx, lookup: GrantLookup) =>
  ctx.directory.preview(lookup),
);

export const edit = mutation((ctx, { edit }: { edit: DirectoryEdit }) =>
  ctx.directory.edit(edit),
);
