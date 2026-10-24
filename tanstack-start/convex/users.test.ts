import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const identity = {
  tokenIdentifier: "https://auth.example|user-1",
  subject: "user-1",
  issuer: "https://auth.example",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("getCurrentUser", () => {
  it("returns null for a signed-out visitor", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.users.getCurrentUser, {})).resolves.toBeNull();
  });

  it("returns the row that updateCurrentUser stored", async () => {
    const t = convexTest(schema, modules).withIdentity(identity);
    const id = await t.mutation(api.users.updateCurrentUser, {});

    await expect(t.query(api.users.getCurrentUser, {})).resolves.toMatchObject({
      _id: id,
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
    });
  });

  it("throws USER_NOT_FOUND when the signed-in user has no row", async () => {
    const t = convexTest(schema, modules).withIdentity(identity);

    const error: unknown = await t
      .query(api.users.getCurrentUser, {})
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConvexError);
    expect(error).toMatchObject({ data: { code: "USER_NOT_FOUND" } });
  });
});

describe("updateCurrentUser", () => {
  it("stores the user once across repeated sign-ins", async () => {
    const t = convexTest(schema, modules).withIdentity(identity);

    const first = await t.mutation(api.users.updateCurrentUser, {});
    const second = await t.mutation(api.users.updateCurrentUser, {});

    expect(second).toBe(first);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
  });
});
