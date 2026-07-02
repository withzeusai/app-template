import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),
  // App data for the documents example. Resource nodes model only the access
  // graph, so a document's own data (its title) lives here, keyed by the
  // resource node's externalId.
  documents: defineTable({
    documentId: v.string(),
    title: v.string(),
  }).index("by_documentId", ["documentId"]),
});
