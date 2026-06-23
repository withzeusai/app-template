import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

function renderProvider() {
  return render(
    <DeploymentEntryProvider>
      <div>App content</div>
    </DeploymentEntryProvider>,
  );
}

describe("DeploymentEntryProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    enterDeployment.mockReset();
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

  it("renders children without checking entry for unauthenticated users", () => {
    renderProvider();

    expect(screen.getByText("App content")).not.toBeNull();
    expect(enterDeployment).not.toHaveBeenCalled();
  });

  it("renders children while authentication is loading", () => {
    authState = {
      ...authState,
      isLoading: true,
    };

    renderProvider();

    expect(screen.getByText("App content")).not.toBeNull();
    expect(enterDeployment).not.toHaveBeenCalled();
  });

  it("checks entry in the background without delaying children", async () => {
    authState = authenticatedUser("background");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockReturnValue(new Promise(() => undefined));

    renderProvider();

    expect(screen.getByText("App content")).not.toBeNull();
    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledWith({
        idToken: "token-background",
      });
    });
  });

  it("keeps children rendered when entry is denied", async () => {
    authState = authenticatedUser("denied");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue({
      allowed: false,
      reason: "blocked",
      status: "blocked",
    });

    renderProvider();

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("App content")).not.toBeNull();
    expect(screen.queryByText("You don't have access")).toBeNull();
  });

  it("keeps children rendered when the background check fails", async () => {
    authState = authenticatedUser("error");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockRejectedValue(new Error("network error"));

    renderProvider();

    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("App content")).not.toBeNull();
    expect(screen.queryByText("We couldn't check your access")).toBeNull();
  });

  it("does not check entry without a usable ID token", () => {
    authState = authenticatedUser("missing-token", "");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };

    renderProvider();

    expect(screen.getByText("App content")).not.toBeNull();
    expect(enterDeployment).not.toHaveBeenCalled();
  });

  it("deduplicates rerenders for the same authenticated identity", async () => {
    authState = authenticatedUser("same-user");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue({ allowed: true, status: "active" });

    const view = renderProvider();
    view.rerender(
      <DeploymentEntryProvider>
        <div>App content</div>
      </DeploymentEntryProvider>,
    );

    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(1);
    });
  });

  it("checks entry again when the authenticated identity changes", async () => {
    authState = authenticatedUser("alice");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue({ allowed: true, status: "active" });

    const view = renderProvider();
    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(1);
    });

    authState = authenticatedUser("bob");
    view.rerender(
      <DeploymentEntryProvider>
        <div>App content</div>
      </DeploymentEntryProvider>,
    );

    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(2);
    });
    expect(enterDeployment).toHaveBeenLastCalledWith({
      idToken: "token-bob",
    });
  });

  it("does not check entry again when only the token renews", async () => {
    authState = authenticatedUser("renewed", "first-token");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue({ allowed: true, status: "active" });

    const view = renderProvider();
    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(1);
    });

    authState = authenticatedUser("renewed", "second-token");
    view.rerender(
      <DeploymentEntryProvider>
        <div>App content</div>
      </DeploymentEntryProvider>,
    );

    expect(enterDeployment).toHaveBeenCalledTimes(1);
  });

  it("checks entry again after signing out and back in", async () => {
    authState = authenticatedUser("returning");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    enterDeployment.mockResolvedValue({ allowed: true, status: "active" });

    const view = renderProvider();
    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(1);
    });

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
    view.rerender(
      <DeploymentEntryProvider>
        <div>App content</div>
      </DeploymentEntryProvider>,
    );

    authState = authenticatedUser("returning", "new-session-token");
    convexAuthState = {
      isAuthenticated: true,
      isLoading: false,
    };
    view.rerender(
      <DeploymentEntryProvider>
        <div>App content</div>
      </DeploymentEntryProvider>,
    );

    await waitFor(() => {
      expect(enterDeployment).toHaveBeenCalledTimes(2);
    });
    expect(enterDeployment).toHaveBeenLastCalledWith({
      idToken: "new-session-token",
    });
  });
});
