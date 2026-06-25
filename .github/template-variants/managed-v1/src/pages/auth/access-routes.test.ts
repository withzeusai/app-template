import { describe, expect, it } from "vitest";
import { getAuthAccessRoute } from "./access-routes.ts";

describe("getAuthAccessRoute", () => {
  it.each([
    ["pending_approval", "/auth/pending-approval"],
    ["blocked", "/auth/blocked"],
    ["suspended", "/auth/suspended"],
    ["removed", "/auth/removed"],
    ["missing", "/auth/missing"],
    ["access_denied", "/auth/access-denied"],
  ])("maps %s to %s", (status, route) => {
    expect(getAuthAccessRoute(status)).toBe(route);
  });

  it("uses access denied for an absent or unknown status", () => {
    expect(getAuthAccessRoute(undefined)).toBe("/auth/access-denied");
    expect(getAuthAccessRoute("active")).toBe("/auth/access-denied");
  });
});
