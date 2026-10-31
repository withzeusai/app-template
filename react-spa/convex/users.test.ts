import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("getCurrentUser", () => {
  it("returns null when signed out", async () => {
    const t = convexTest(schema, modules);

    expect(await t.query(api.users.getCurrentUser, {})).toBeNull();
  });

  it("throws USER_NOT_FOUND for a signed-in user with no row", async () => {
    const asUser = convexTest(schema, modules).withIdentity({ name: "Ada" });

    await expect(
      asUser.query(api.users.getCurrentUser, {}),
    ).rejects.toMatchObject({
      data: { code: "USER_NOT_FOUND" },
    });
  });

  it("returns the row updateCurrentUser created", async () => {
    const asUser = convexTest(schema, modules).withIdentity({
      name: "Ada",
      email: "ada@example.com",
    });

    const userId = await asUser.mutation(api.users.updateCurrentUser, {});

    expect(await asUser.query(api.users.getCurrentUser, {})).toMatchObject({
      _id: userId,
      name: "Ada",
      email: "ada@example.com",
    });
  });
});
