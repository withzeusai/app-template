import { describe, expect, it } from "vitest";
import { resolveReturnTo } from "./return-to.ts";

describe("resolveReturnTo", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(resolveReturnTo("/notes/42?tab=edit#top")).toBe(
      "/notes/42?tab=edit#top",
    );
  });

  it.each([
    null,
    "",
    "https://evil.example/notes/1",
    "//evil.example/notes/1",
    "/\\evil.example",
    "/auth/sign-in",
    "/auth/callback?code=x",
  ])("falls back to / for %s", (returnTo) => {
    expect(resolveReturnTo(returnTo)).toBe("/");
  });
});
