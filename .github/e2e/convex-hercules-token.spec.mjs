import { expect, test } from "@playwright/test";

// `herculesToken()` in the production build's Worker. Publishing gives the
// Worker a `HERCULES` binding; this build has none, so server code must get
// the API key from the Worker's environment instead of throwing.
test("server code falls back to the API key when the app has no identity binding", async ({
  request,
}) => {
  const response = await request.get("/ci-e2e-hercules-token");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    isApiKey: true,
    length: "ci-e2e-worker-api-key".length,
  });
});
