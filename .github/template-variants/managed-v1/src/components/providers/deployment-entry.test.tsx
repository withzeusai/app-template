import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeploymentEntryProvider } from "./deployment-entry.tsx";

const enterDeployment = vi.fn();
const signin = vi.fn();
const signout = vi.fn();

let authState = {
  isAuthenticated: false,
  isLoading: false,
  signout,
  signin,
  user: undefined as
    | undefined
    | {
        id_token?: string;
        profile: { iss?: string; sub?: string };
      },
};

let convexAuthState = {
  isAuthenticated: false,
  isLoading: false,
};

vi.mock("@usehercules/auth/react", () => ({
  useAuth: () => authState,
}));

vi.mock("convex/react", () => ({
  useAction: () => enterDeployment,
  useConvexAuth: () => convexAuthState,
}));

vi.mock("@/convex/_generated/api.js", () => ({
  api: {
    accessUser: {
      enterDeployment: "accessUser:enterDeployment",
    },
  },
}));

function authenticatedUser(subject: string, token = `token-${subject}`) {
  return {
    isAuthenticated: true,
    isLoading: false,
    signout,
    signin,
    user: {
      id_token: token,
      profile: {
        iss: "https://auth.example.com",
        sub: subject,
      },
    },
  };
}

function allowedResult() {
  return {
    allowed: true,
    changed: false,
    principalId: "principal_1",
    reason: "allowed",
    stateVersion: 1,
    status: "active" as const,
  };
}

function renderGate() {
  return render(
    <DeploymentEntryProvider>
      <div>Protected content</div>
    </DeploymentEntryProvider>,
  );
}

describe("DeploymentEntryProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    enterDeployment.mockReset();
    signout.mockReset();
    signin.mockReset();
    vi.useRealTimers();
    authState = {
      isAuthenticated: false,
      isLoading: false,
      signout,
      signin,
      user: undefined,
    };
    convexAuthState = {
      isAuthenticated: false,
      isLoading: false,
    };
  });

  it("renders children without an entry request for unauthenticated users", () => {
    renderGate();

    expect(screen.queryByText("Protected content")).not.toBeNull();
    expect(enterDeployment).not.toHaveBeenCalled();
  });

  it("blocks children while authenticated Convex state is loading", () => {
    authState = authenticatedUser("loading");
    convexAuthState = {
      isAuthenticated: false,
      isLoading: true,
    };

    renderGate();

    expect(screen.queryByText("Checking access...")).toBeNull();
    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeNull();
    expect(screen.queryByText("Protected content")).toBeNull();
    expect(enterDeployment).not.toHaveBeenCalled();
  });

  it("renders children only after deployment entry is allowed", async () => {
    authState = authenticatedUser("allowed");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValueOnce(allowedResult());

    renderGate();

    expect(screen.queryByText("Protected content")).toBeNull();
    expect(await screen.findByText("Protected content")).not.toBeNull();
    expect(enterDeployment).toHaveBeenCalledWith({
      idToken: "token-allowed",
    });
  });

  it("explains when the account does not have access", async () => {
    authState = authenticatedUser("denied");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValueOnce({
      ...allowedResult(),
      allowed: false,
      reason: "blocked",
      status: "blocked",
    });

    renderGate();

    expect(await screen.findByText("You don't have access")).not.toBeNull();
    expect(
      screen.queryByText("This account is not allowed to access this app."),
    ).not.toBeNull();
    expect(screen.queryByText("Protected content")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeNull();
  });

  it.each([
    {
      status: "suspended" as const,
      title: "Your access is suspended",
      description: "Contact an administrator if you think this is a mistake.",
    },
    {
      status: "removed" as const,
      title: "You no longer have access",
      description: "Contact an administrator if you need access again.",
    },
  ])(
    "explains when access is $status",
    async ({ status, title, description }) => {
      authState = authenticatedUser(status);
      convexAuthState = {
        isAuthenticated: true,
        isLoading: false,
      };
      enterDeployment.mockResolvedValueOnce({
        ...allowedResult(),
        allowed: false,
        reason: status,
        status,
      });

      renderGate();

      expect(await screen.findByText(title)).not.toBeNull();
      expect(screen.queryByText(description)).not.toBeNull();
      expect(screen.queryByText("Protected content")).toBeNull();
    },
  );

  it("surfaces pending approval distinctly from a hard denial", async () => {
    authState = authenticatedUser("pending");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValueOnce({
      ...allowedResult(),
      allowed: false,
      reason: "not_allowlisted",
      status: "pending_approval",
    });

    renderGate();

    expect(await screen.findByText("Approval pending")).not.toBeNull();
    expect(
      screen.queryByText(
        "Your request is waiting for approval. Check again after an administrator reviews it.",
      ),
    ).not.toBeNull();
    expect(screen.queryByText("You don't have access")).toBeNull();
    expect(screen.queryByText("Protected content")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Check again" }),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeNull();
  });

  it("blocks children when the entry request fails", async () => {
    authState = authenticatedUser("error");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockRejectedValueOnce(new Error("network error"));

    renderGate();

    expect(
      await screen.findByText("We couldn't check your access"),
    ).not.toBeNull();
    expect(
      screen.queryByText("Try again. If the problem continues, sign in again."),
    ).not.toBeNull();
    expect(screen.queryByText("Protected content")).toBeNull();
  });

  it("fails closed when the authenticated user has no ID token", async () => {
    authState = authenticatedUser("missing-token", "");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };

    renderGate();

    expect(
      await screen.findByText("We couldn't check your access"),
    ).not.toBeNull();
    expect(screen.queryByText("Protected content")).toBeNull();
    expect(enterDeployment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(signin).toHaveBeenCalledTimes(1);
  });

  it("shows recovery actions when the entry request times out", async () => {
    vi.useFakeTimers();
    authState = authenticatedUser("timeout");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockReturnValue(new Promise(() => undefined));

    renderGate();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(screen.queryByText("We couldn't check your access")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeNull();
  });

  it("checks entry again when the authenticated subject changes", async () => {
    authState = authenticatedUser("alice");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue(allowedResult());

    const view = renderGate();
    await screen.findByText("Protected content");

    authState = authenticatedUser("bob");
    view.rerender(
      <DeploymentEntryProvider>
        <div>Protected content</div>
      </DeploymentEntryProvider>,
    );

    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(2);
    });
    expect(enterDeployment).toHaveBeenLastCalledWith({
      idToken: "token-bob",
    });
  });

  it("deduplicates rerenders for the same issuer and subject", async () => {
    authState = authenticatedUser("deduplicated");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    let resolveEntry:
      | ((value: ReturnType<typeof allowedResult>) => void)
      | null = null;
    enterDeployment.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveEntry = resolve;
      }),
    );

    const view = renderGate();
    view.rerender(
      <DeploymentEntryProvider>
        <div>Protected content</div>
      </DeploymentEntryProvider>,
    );

    expect(enterDeployment).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveEntry?.(allowedResult());
    });
    expect(await screen.findByText("Protected content")).not.toBeNull();
  });

  it("does not recheck entry when the token renews for the same subject", async () => {
    authState = authenticatedUser("renewed", "first-token");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue(allowedResult());

    const view = renderGate();
    await screen.findByText("Protected content");

    authState = authenticatedUser("renewed", "second-token");
    view.rerender(
      <DeploymentEntryProvider>
        <div>Protected content</div>
      </DeploymentEntryProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected content")).not.toBeNull();
    });
    expect(enterDeployment).toHaveBeenCalledTimes(1);
    expect(enterDeployment).toHaveBeenCalledWith({ idToken: "first-token" });
  });

  it("ignores a late decision after the authenticated subject changes", async () => {
    authState = authenticatedUser("late-alice");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    let resolveAlice:
      | ((value: ReturnType<typeof allowedResult>) => void)
      | null = null;
    enterDeployment
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveAlice = resolve;
        }),
      )
      .mockResolvedValueOnce({
        ...allowedResult(),
        allowed: false,
        reason: "blocked",
        status: "blocked",
      });

    const view = renderGate();
    authState = authenticatedUser("late-bob");
    view.rerender(
      <DeploymentEntryProvider>
        <div>Protected content</div>
      </DeploymentEntryProvider>,
    );
    await screen.findByText("You don't have access");

    await act(async () => {
      resolveAlice?.(allowedResult());
    });

    expect(screen.queryByText("Protected content")).toBeNull();
    expect(screen.queryByText("You don't have access")).not.toBeNull();
  });

  it("clears only the current cached decision when retrying", async () => {
    authState = authenticatedUser("retry");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment
      .mockResolvedValueOnce({
        ...allowedResult(),
        allowed: false,
        reason: "blocked",
        status: "blocked",
      })
      .mockResolvedValueOnce(allowedResult());

    renderGate();
    await screen.findByText("You don't have access");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Protected content")).not.toBeNull();
    expect(enterDeployment).toHaveBeenCalledTimes(2);
  });

  it("clears the current cached decision when retrying after token loss", async () => {
    authState = authenticatedUser("lost-token");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue(allowedResult());

    const view = renderGate();
    await screen.findByText("Protected content");

    authState = authenticatedUser("lost-token", "");
    view.rerender(
      <DeploymentEntryProvider>
        <div>Protected content</div>
      </DeploymentEntryProvider>,
    );
    await screen.findByText("We couldn't check your access");
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(signin).toHaveBeenCalledTimes(1);

    authState = authenticatedUser("lost-token", "restored-token");
    view.rerender(
      <DeploymentEntryProvider>
        <div>Protected content</div>
      </DeploymentEntryProvider>,
    );

    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(2);
    });
    expect(enterDeployment).toHaveBeenLastCalledWith({
      idToken: "restored-token",
    });
  });

  it("shows a controlled error when sign out fails", async () => {
    authState = authenticatedUser("signout-error");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValueOnce({
      ...allowedResult(),
      allowed: false,
      reason: "blocked",
      status: "blocked",
    });
    signout.mockRejectedValueOnce(new Error("signout failed"));

    renderGate();
    await screen.findByText("You don't have access");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByText("We couldn't sign you out. Try again."),
    ).not.toBeNull();
    expect(screen.queryByText("Protected content")).toBeNull();
  });
});
