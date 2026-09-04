import { act, fireEvent, render, screen } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HerculesIAM,
  IamAccessRoute,
  IamAccessStateView,
  RequireSignIn,
  getAuthAccessPath,
  getAuthAccessRoute,
  isAuthAccessPath,
} from "./hercules-iam.tsx";

// ── mocks ──────────────────────────────────────────────────────────────────────

const navigate = vi.fn((_options?: unknown) => Promise.resolve());
const signOut = vi.fn(() => Promise.resolve());
const evaluateAccess = vi.fn();
const historyBack = vi.fn();

type AuthState = {
  user: { id: string } | null;
  sessionId: string | undefined;
  loading: boolean;
  signOut: typeof signOut;
};

let authState: AuthState = {
  user: null,
  sessionId: undefined,
  loading: false,
  signOut,
};
let convexAuthState = { isAuthenticated: false, isLoading: false };
let tenantAccessStatus: unknown = undefined;
let locationState = { href: "/", pathname: "/" };

vi.mock("@tanstack/react-router", () => ({
  Navigate: (props: Record<string, unknown>) => {
    navigate(props);
    return null;
  },
  useLocation: () => locationState,
  useNavigate: () => navigate,
  useRouter: () => ({ history: { back: historyBack } }),
}));

vi.mock("@usehercules/auth-tanstack/client", () => ({
  useAuth: () => authState,
}));

vi.mock("convex/react", () => ({
  useAction: () => evaluateAccess,
  useConvexAuth: () => convexAuthState,
  useQuery: () => tenantAccessStatus,
}));

vi.mock("@/convex/_generated/api.js", () => ({
  api: {
    iam: {
      evaluateAccess: "iam:evaluateAccess",
      getTenantAccessStatus: "iam:getTenantAccessStatus",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function signedIn(id = "user_1", sessionId = `session-${id}`): AuthState {
  return { user: { id }, sessionId, loading: false, signOut };
}

function accessDeniedError(reasonCode: string) {
  return new ConvexError({ code: "ACCESS_DENIED", reasonCode });
}

function Throws({ error }: { error: unknown }): never {
  throw error;
}

beforeEach(() => {
  navigate.mockClear();
  signOut.mockClear();
  historyBack.mockClear();
  evaluateAccess.mockReset();
  authState = { user: null, sessionId: undefined, loading: false, signOut };
  convexAuthState = { isAuthenticated: false, isLoading: false };
  tenantAccessStatus = undefined;
  locationState = { href: "/", pathname: "/" };
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── route mapping ──────────────────────────────────────────────────────────────

describe("access route mapping", () => {
  it("maps every access status to a /auth/* page", () => {
    expect(getAuthAccessRoute("pending_approval")).toBe(
      "/auth/pending-approval",
    );
    expect(getAuthAccessRoute("blocked")).toBe("/auth/blocked");
    expect(getAuthAccessRoute("suspended")).toBe("/auth/suspended");
    expect(getAuthAccessRoute("removed")).toBe("/auth/removed");
    expect(getAuthAccessRoute("missing")).toBe("/auth/missing");
    expect(getAuthAccessRoute("access_denied")).toBe("/auth/access-denied");
  });

  it("falls back to access denied for unknown statuses", () => {
    expect(getAuthAccessPath(undefined)).toBe("access-denied");
    expect(getAuthAccessRoute("active")).toBe("/auth/access-denied");
  });

  it("recognizes only the access-state path segments", () => {
    expect(isAuthAccessPath("pending-approval")).toBe(true);
    expect(isAuthAccessPath("sign-in")).toBe(false);
    expect(isAuthAccessPath("callback")).toBe(false);
    expect(isAuthAccessPath(undefined)).toBe(false);
  });
});

// ── access-state screens ───────────────────────────────────────────────────────

describe("IamAccessStateView", () => {
  it("offers a re-check for pending approval", async () => {
    const onCheckAgain = vi.fn();
    render(
      <IamAccessStateView
        state="pending_approval"
        onCheckAgain={onCheckAgain}
        onSignOut={signOut}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Your access request is pending" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("only offers sign out for a hard denial", () => {
    render(
      <IamAccessStateView
        state="blocked"
        onCheckAgain={vi.fn()}
        onRetry={vi.fn()}
        onSignOut={signOut}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("reports a failed action", () => {
    render(
      <IamAccessStateView state="error" actionFailed onSignOut={signOut} />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "We couldn't complete that action. Please try again.",
    );
  });
});

describe("IamAccessRoute", () => {
  it("renders the access state named by the path", () => {
    authState = signedIn();
    render(<IamAccessRoute path="suspended" />);

    expect(
      screen.getByRole("heading", { name: "Your access is suspended" }),
    ).toBeInTheDocument();
  });

  it("renders nothing for an unknown segment", () => {
    const view = render(<IamAccessRoute path="sign-in" />);

    expect(view.container.firstChild).toBeNull();
  });

  it("re-checks access and routes on the result", async () => {
    authState = signedIn();
    evaluateAccess.mockResolvedValueOnce({
      allowed: false,
      status: "blocked",
      reason: "blocked",
    });
    render(<IamAccessRoute path="pending-approval" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    });

    expect(evaluateAccess).toHaveBeenCalledWith({});
    expect(navigate).toHaveBeenCalledWith({
      to: "/auth/$state",
      params: { state: "blocked" },
      replace: true,
    });

    evaluateAccess.mockResolvedValueOnce({
      allowed: true,
      status: "active",
      reason: "membership_active",
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    });

    expect(navigate).toHaveBeenLastCalledWith({ to: "/", replace: true });
  });
});

// ── RequireSignIn ──────────────────────────────────────────────────────────────

describe("RequireSignIn", () => {
  it("renders children for a signed-in user", () => {
    authState = signedIn();
    render(
      <RequireSignIn>
        <div>Private content</div>
      </RequireSignIn>,
    );

    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("renders children while auth is loading", () => {
    authState = { ...authState, loading: true };
    render(
      <RequireSignIn>
        <div>Private content</div>
      </RequireSignIn>,
    );

    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects home right away when there is no session", () => {
    render(
      <RequireSignIn>
        <div>Private content</div>
      </RequireSignIn>,
    );

    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith({ to: "/", replace: true });
  });

  it("waits out the grace window when a session disappears", () => {
    vi.useFakeTimers();
    try {
      authState = signedIn();
      const view = render(
        <RequireSignIn>
          <div>Private content</div>
        </RequireSignIn>,
      );

      authState = { user: null, sessionId: undefined, loading: false, signOut };
      view.rerender(
        <RequireSignIn>
          <div>Private content</div>
        </RequireSignIn>,
      );

      expect(screen.getByText("Private content")).toBeInTheDocument();
      expect(navigate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1_500);
      });

      expect(screen.queryByText("Private content")).not.toBeInTheDocument();
      expect(navigate).toHaveBeenCalledWith({ to: "/", replace: true });
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── HerculesIAM: deployment entry ──────────────────────────────────────────────

describe("HerculesIAM deployment entry", () => {
  function renderApp() {
    return render(
      <HerculesIAM>
        <div>App shell</div>
      </HerculesIAM>,
    );
  }

  it("renders the shell without an entry request while signed out", () => {
    renderApp();

    expect(screen.getByText("App shell")).toBeInTheDocument();
    expect(evaluateAccess).not.toHaveBeenCalled();
  });

  it("waits for the Convex client to authenticate", () => {
    authState = signedIn();
    renderApp();

    expect(evaluateAccess).not.toHaveBeenCalled();
  });

  it("enters once per session and keeps rendering the shell when allowed", async () => {
    authState = signedIn();
    convexAuthState = { isAuthenticated: true, isLoading: false };
    evaluateAccess.mockResolvedValue({
      allowed: true,
      status: "active",
      reason: "membership_active",
    });

    const view = await act(async () => renderApp());
    await act(async () => {
      view.rerender(
        <HerculesIAM>
          <div>App shell</div>
        </HerculesIAM>,
      );
    });

    expect(screen.getByText("App shell")).toBeInTheDocument();
    expect(evaluateAccess).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    // A remount in the same browser session does not re-enter.
    view.unmount();
    await act(async () => renderApp());
    expect(evaluateAccess).toHaveBeenCalledTimes(1);
  });

  it("routes a denied user to the matching access page", async () => {
    authState = signedIn();
    convexAuthState = { isAuthenticated: true, isLoading: false };
    evaluateAccess.mockResolvedValue({
      allowed: false,
      status: "pending_approval",
      reason: "pending_approval",
    });

    await act(async () => renderApp());

    expect(navigate).toHaveBeenCalledWith({
      to: "/auth/$state",
      params: { state: "pending-approval" },
      replace: true,
    });
  });

  it("sends an admitted user home from an access page", async () => {
    authState = signedIn();
    convexAuthState = { isAuthenticated: true, isLoading: false };
    window.history.replaceState(null, "", "/auth/pending-approval");
    evaluateAccess.mockResolvedValue({
      allowed: true,
      status: "active",
      reason: "membership_active",
    });

    await act(async () => renderApp());

    expect(navigate).toHaveBeenCalledWith({ to: "/", replace: true });
  });

  it("re-enters for a new session", async () => {
    authState = signedIn("user_1", "session-a");
    convexAuthState = { isAuthenticated: true, isLoading: false };
    evaluateAccess.mockResolvedValue({
      allowed: true,
      status: "active",
      reason: "membership_active",
    });

    const view = await act(async () => renderApp());
    authState = signedIn("user_1", "session-b");
    await act(async () => {
      view.rerender(
        <HerculesIAM>
          <div>App shell</div>
        </HerculesIAM>,
      );
    });

    expect(evaluateAccess).toHaveBeenCalledTimes(2);
  });
});

// ── HerculesIAM: error boundary ────────────────────────────────────────────────

describe("HerculesIAM error boundary", () => {
  it("routes admission denials thrown while rendering to the access page", () => {
    authState = signedIn();
    render(
      <HerculesIAM>
        <Throws error={accessDeniedError("membership_suspended")} />
      </HerculesIAM>,
    );

    expect(navigate).toHaveBeenCalledWith({
      to: "/auth/$state",
      params: { state: "suspended" },
      replace: true,
    });
  });

  it("shows the permission page with a way back", () => {
    authState = signedIn();
    window.history.pushState(null, "", "/private");
    render(
      <HerculesIAM>
        <Throws error={accessDeniedError("permission_denied")} />
      </HerculesIAM>,
    );

    expect(
      screen.getByRole("heading", {
        name: "You don't have access to this page",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(historyBack).toHaveBeenCalledTimes(1);
  });

  it("shows a generic fallback for non-IAM errors", () => {
    authState = signedIn();
    render(
      <HerculesIAM>
        <Throws error={new Error("boom")} />
      </HerculesIAM>,
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("retries silently while access is still syncing", () => {
    vi.useFakeTimers();
    try {
      authState = signedIn();
      const view = render(
        <HerculesIAM>
          <Throws error={accessDeniedError("mirror_not_ready")} />
        </HerculesIAM>,
      );

      expect(view.container.textContent).toBe("");
      expect(
        screen.queryByRole("heading", { name: "Preparing your access" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
