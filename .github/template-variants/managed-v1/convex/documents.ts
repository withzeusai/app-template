// Example domain feature: documents that live inside projects. It shows the
// Hercules ReBAC resource path end to end:
//
//   - createDocument authorizes "app.document:manage" on the parent project,
//     then registers the new document as a resource node under that project and
//     stores its title in the documents table.
//   - updateDocumentTitle authorizes "app.document:manage" on the document
//     itself with requirePermissions, demonstrating the in-handler check.
//   - getDocument / listProjectDocuments read through resource.get /
//     resource.list with "app.document:read", so the component returns only the
//     resources the caller is allowed to see; the title comes from the table.
//
// Resource nodes model only the access graph, so the document's own data lives
// in the documents table. The permissions, resource types, and the "editor"
// role it relies on are declared in .hercules/iam.jsonc.
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server.js";
import { mutation, query, requirePermissions, resource } from "./iam.js";

async function readTitle(ctx: QueryCtx, documentId: string): Promise<string> {
  const row = await ctx.db
    .query("documents")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .unique();
  return row?.title ?? "Untitled";
}

export const createDocument = mutation({
  args: {
    projectId: v.string(),
    documentId: v.string(),
    title: v.string(),
  },
  permission: "app.document:manage",
  resource: (_ctx, args) => ({
    type: "app.project",
    externalId: args.projectId,
  }),
  handler: async (ctx, args) => {
    const node = await resource.write(ctx, {
      type: "app.document",
      externalId: args.documentId,
      parent: { type: "app.project", externalId: args.projectId },
    });
    if (!node) return null;
    await ctx.db.insert("documents", {
      documentId: args.documentId,
      title: args.title,
    });
    return { id: node.externalId, title: args.title };
  },
});

export const updateDocumentTitle = mutation({
  args: {
    documentId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const target = { type: "app.document", externalId: args.documentId };
    await requirePermissions(ctx, "app.document:manage", { resource: target });
    const existing = await resource.get(ctx, target);
    if (!existing) return null;
    const row = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, { title: args.title });
    } else {
      await ctx.db.insert("documents", {
        documentId: args.documentId,
        title: args.title,
      });
    }
    return { id: existing.externalId, title: args.title };
  },
});

export const getDocument = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const node = await resource.get(ctx, {
      type: "app.document",
      externalId: args.documentId,
      permission: "app.document:read",
    });
    if (!node) return null;
    return { id: node.externalId, title: await readTitle(ctx, node.externalId) };
  },
});

export const listProjectDocuments = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const page = await resource.list(ctx, {
      type: "app.document",
      parent: { type: "app.project", externalId: args.projectId },
      permission: "app.document:read",
    });
    const documents: Array<{ id: string; title: string }> = [];
    for (const node of page.resources) {
      documents.push({
        id: node.externalId,
        title: await readTitle(ctx, node.externalId),
      });
    }
    return documents;
  },
});
