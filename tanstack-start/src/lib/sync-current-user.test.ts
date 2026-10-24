import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/convex/_generated/api.js";
import { syncCurrentUser } from "./sync-current-user.ts";

const mocks = vi.hoisted(() => ({
  setAuth: vi.fn(),
  mutation: vi.fn(),
  publicConvexClient: vi.fn(),
}));

vi.mock("./convex-server.ts", () => ({
  publicConvexClient: mocks.publicConvexClient,
}));

beforeEach(() => {
  mocks.setAuth.mockReset();
  mocks.mutation.mockReset().mockResolvedValue("user-id");
  mocks.publicConvexClient.mockReset().mockReturnValue({
    setAuth: mocks.setAuth,
    mutation: mocks.mutation,
  });
});

describe("syncCurrentUser", () => {
  it("upserts the user as the signed-in identity", async () => {
    await syncCurrentUser("id-token");

    expect(mocks.setAuth).toHaveBeenCalledExactlyOnceWith("id-token");
    expect(mocks.mutation).toHaveBeenCalledExactlyOnceWith(
      api.users.updateCurrentUser,
      {},
    );
    expect(mocks.setAuth.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.mutation.mock.invocationCallOrder[0],
    );
  });

  it("does nothing without an ID token", async () => {
    await syncCurrentUser(undefined);

    expect(mocks.publicConvexClient).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("retries a failed sync once", async () => {
    mocks.mutation
      .mockRejectedValueOnce(new Error("Convex is unreachable"))
      .mockResolvedValueOnce("user-id");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await syncCurrentUser("id-token", { retryDelayMs: 0 });

    expect(mocks.mutation).toHaveBeenCalledTimes(2);
    expect(mocks.setAuth).toHaveBeenNthCalledWith(2, "id-token");
    expect(consoleWarn).toHaveBeenCalledOnce();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs a sync that fails twice instead of failing sign-in", async () => {
    const error = new Error("Convex is unreachable");
    mocks.mutation.mockRejectedValue(error);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      syncCurrentUser("id-token", { retryDelayMs: 0 }),
    ).resolves.toBeUndefined();
    expect(mocks.mutation).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to sync the signed-in user to Convex:",
      error,
    );
  });
});
