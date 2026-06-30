// Example domain feature: documents that live inside projects. It shows the
// Hercules ReBAC resource path end to end:
//
//   - createDocument authorizes "app.document:manage" on the parent project,
//     then registers the new document as a resource node under that project.
//   - updateDocumentTitle authorizes "app.document:manage" on the document
//     itself with iam.require, demonstrating the in-handler check.
//   - getDocument / listProjectDocuments read through resource.get /
//     resource.list with "app.document:read", so the component returns only the
//     resources the caller is allowed to see.
//
// The document's own data lives on the resource node (data field), so this
// feature needs no extra app table. The permissions, resource types, and the
// "editor" role it relies on are declared in hercules/iam.jsonc.
import { v } from "convex/values";
import { iam, mutation, query, resource } from "./iam.js";

type DocumentData = { title: string };

type DocumentNode = { externalId: string; data?: unknown };

function toDocument(node: DocumentNode) {
  const data = node.data as Partial<DocumentData> | undefined;
  return { id: node.externalId, title: data?.title ?? "Untitled" };
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
      data: { title: args.title } satisfies DocumentData,
    });
    return node ? toDocument(node) : null;
  },
});

export const updateDocumentTitle = mutation({
  args: {
    documentId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const target = { type: "app.document", externalId: args.documentId };
    await iam.require(ctx, "app.document:manage", { resource: target });
    const existing = await resource.get(ctx, target);
    if (!existing) return null;
    const node = await resource.write(ctx, {
      ...target,
      ...(existing.parent === undefined ? {} : { parent: existing.parent }),
      data: { title: args.title } satisfies DocumentData,
    });
    return node ? toDocument(node) : null;
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
    return node ? toDocument(node) : null;
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
    return page.resources.map(toDocument);
  },
});
