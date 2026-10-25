import { describe, expect, it } from "vitest";
import { readAuthError } from "./auth-error.ts";

describe("readAuthError", () => {
  it("returns null when the URL has no auth error", () => {
    expect(readAuthError("https://app.example/notes?tab=edit")).toBeNull();
  });

  it("explains a cancelled sign-in and keeps the rest of the URL", () => {
    expect(
      readAuthError(
        "https://app.example/pricing?plan=pro&auth_error=access_denied#faq",
      ),
    ).toEqual({
      message: "Sign-in was cancelled.",
      cleanPath: "/pricing?plan=pro#faq",
    });
  });

  it("explains an expired sign-in", () => {
    expect(
      readAuthError("https://app.example/?auth_error=sign_in_expired"),
    ).toEqual({
      message: "That sign-in expired. Please sign in again.",
      cleanPath: "/",
    });
  });

  it.each(["invalid_callback", "provider_error", "something_new"])(
    "falls back to a general message for %s",
    (reason) => {
      expect(
        readAuthError(`https://app.example/?auth_error=${reason}`)?.message,
      ).toBe("Sign-in didn't complete. Please try again.");
    },
  );
});
