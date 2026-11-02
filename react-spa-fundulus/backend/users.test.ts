import { fundulusTest } from "fundulus/test";
import { describe, expect, it } from "vitest";
import { api } from "./.fundulus/api";

// Hercules sets these on the app's databases; tests set their own.
const env = {
  HERCULES_OIDC_AUTHORITY: "https://auth.example.com",
  HERCULES_OIDC_CLIENT_ID: "app",
  HERCULES_API_KEY: "test",
};

describe("users", () => {
  it("stores the signed-in user once", async () => {
    const backend = await fundulusTest({ env });
    const ada = backend.as({
      subject: "ada",
      name: "Ada",
      email: "ada@example.com",
    });

    const id = await ada.mutation(api.users.updateCurrentUser);
    expect(await ada.mutation(api.users.updateCurrentUser)).toBe(id);
    expect(await ada.query(api.users.getCurrentUser)).toMatchObject({
      _id: id,
      name: "Ada",
      email: "ada@example.com",
    });
  });

  it("refuses callers who aren't signed in", async () => {
    const backend = await fundulusTest({ env });
    await expect(backend.query(api.users.getCurrentUser)).rejects.toMatchObject(
      { data: { code: "UNAUTHENTICATED" } },
    );
    await expect(
      backend.mutation(api.users.updateCurrentUser),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});
