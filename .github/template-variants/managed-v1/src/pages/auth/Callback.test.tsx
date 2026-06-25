import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "./Callback.tsx";

const evaluateAccess = vi.fn();
const retry = vi.fn();
const signout = vi.fn();
const updateCurrentUser = vi.fn();

let authCallbackOptions: {
  onSync: () => Promise<void>;
};

vi.mock("@usehercules/auth/react", () => ({
  useAuth: () => ({ signout }),
  useAuthCallback: (options: typeof authCallbackOptions) => {
    authCallbackOptions = options;
    return { status: "loading", retry };
  },
}));

vi.mock("convex/react", () => ({
  useAction: () => evaluateAccess,
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => updateCurrentUser,
}));

vi.mock("@/convex/_generated/api.js", () => ({
  api: {
    iam: {
      evaluateAccess: "iam:evaluateAccess",
    },
    users: {
      updateCurrentUser: "users:updateCurrentUser",
    },
  },
}));

describe("AuthCallback", () => {
  beforeEach(() => {
    evaluateAccess.mockReset();
    retry.mockReset();
    signout.mockReset();
    updateCurrentUser.mockReset();
    updateCurrentUser.mockResolvedValue(undefined);
  });

  it("redirects pending access to its dedicated route", async () => {
    evaluateAccess.mockResolvedValue({
      allowed: false,
      status: "pending_approval",
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback?code=test&state=test"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/auth/pending-approval"
            element={<div>Pending access route</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await authCallbackOptions.onSync();
    });

    expect(screen.getByText("Pending access route")).toBeInTheDocument();
    expect(
      screen.queryByText("Your access request is pending"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["blocked", "/auth/blocked"],
    ["suspended", "/auth/suspended"],
    ["removed", "/auth/removed"],
    ["missing", "/auth/missing"],
    [undefined, "/auth/access-denied"],
  ])("redirects %s access to %s", async (status, route) => {
    evaluateAccess.mockResolvedValue({
      allowed: false,
      status,
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback?code=test&state=test"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path={route} element={<div>Access status route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await authCallbackOptions.onSync();
    });

    expect(screen.getByText("Access status route")).toBeInTheDocument();
  });

  it("redirects allowed access home", async () => {
    evaluateAccess.mockResolvedValue({
      allowed: true,
      status: "active",
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback?code=test&state=test"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<div>App home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await authCallbackOptions.onSync();
    });

    expect(screen.getByText("App home")).toBeInTheDocument();
  });
});
