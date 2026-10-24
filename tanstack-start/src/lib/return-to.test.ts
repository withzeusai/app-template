import { describe, expect, it } from "vitest";
import { resolveReturnTo } from "./return-to.ts";

describe("resolveReturnTo", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(resolveReturnTo("/notes/42?tab=edit#top")).toBe(
      "/notes/42?tab=edit#top",
    );
  });

  it("returns the normalized path", () => {
    expect(resolveReturnTo("/notes/../settings")).toBe("/settings");
    expect(resolveReturnTo("/no\ttes")).toBe("/notes");
  });

  it.each([
    null,
    "",
    "notes",
    " /notes",
    "https://evil.example/notes/1",
    "//evil.example/notes/1",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\n/evil.example",
    "/\\\t\\evil.example",
    "/.//evil.example",
    "/auth/sign-in",
    "/AUTH/sign-in",
    "/auth/callback?code=x",
    "/x/../auth/sign-in",
  ])("falls back to / for %j", (returnTo) => {
    expect(resolveReturnTo(returnTo)).toBe("/");
  });
});
