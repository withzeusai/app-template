import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import { signToken } from "./hercules";
import schema from "./schema";
import { modules } from "./test.setup";

function claimsOf(token: string): Record<string, unknown> {
  const [, payload = ""] = token.split(".");
  return JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
}

test("signs a 15-minute token addressed to Hercules", async () => {
  const t = convexTest(schema, modules);

  const token = await t.mutation(internal.hercules.signToken, {});

  const claims = claimsOf(token);
  expect(claims.aud).toBe("https://api.hercules.app");
  expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
  expect(claims.iss).toEqual(expect.any(String));
});

test("is internal, so no client can ask the deployment for a token", () => {
  expect(signToken.isInternal).toBe(true);
  expect(signToken.isMutation).toBe(true);
});
