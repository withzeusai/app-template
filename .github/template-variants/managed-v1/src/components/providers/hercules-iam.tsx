// HerculesIAM - ALL Hercules IAM access UI in one file: the provider (deployment
// entry after sign-in + access error boundary + watchdog), signed-in gating
// (RequireSignIn), the /auth/* access pages (IamAccessRoute, mounted by
// src/routes/auth/$state.tsx), and the access-state screens. Wired once in
// providers/convex.tsx; apps never need to read or modify it.
// Rule (follow it in app code too): never block rendering behind a loading
// screen. Render the shell; access problems surface as routed pages or a toast.
//
// TanStack Start notes:
// - The provider renders inside the root route component, above <Outlet />.
//   Route matches only get their own error boundary when a route declares
//   `errorComponent` (or the router a `defaultErrorComponent`); the template
//   declares neither, so IAM errors thrown while rendering a route (a denied
//   Convex query, for example) reach the boundary here.
// - Sign-in is a server-side redirect flow (/auth/sign-in -> provider ->
//   /auth/callback -> back into the app), so deployment entry runs client-side
//   once per session as soon as the Convex client is authenticated, instead of
//   on a callback page.

import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useAuth } from "@usehercules/auth-tanstack/client";
import {
  classifyAccessError,
  type AccessErrorClassification,
} from "@usehercules/convex";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  Clock3Icon,
  LockKeyholeIcon,
  ShieldXIcon,
  UserRoundXIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

// Signed-out must persist this long before redirecting a user who had a
// session: a session refresh can leave `user` empty for a moment.
const SIGNED_OUT_REDIRECT_GRACE_MS = 1_500;

// Silent-retry budget for still-syncing access before surfacing a toast + page.
const ACCESS_WATCHDOG_MS = 7_000;

const TEMPORARY_RETRY_MS = 800;

// ── access-state screen UI ─────────────────────────────────────────────────────

export type IamAccessState =
  | "pending_approval"
  | "blocked"
  | "suspended"
  | "removed"
  | "missing"
  | "access_denied"
  | "permission_denied"
  | "mirror_not_ready"
  | "error";

type AccessStateContent = {
  description: string;
  icon: LucideIcon;
  title: string;
};

const ACCESS_STATE_CONTENT: Record<IamAccessState, AccessStateContent> = {
  pending_approval: {
    title: "Your access request is pending",
    description:
      "An app administrator needs to approve your request before you can continue.",
    icon: Clock3Icon,
  },
  blocked: {
    title: "Your access is blocked",
    description:
      "An app administrator has blocked this account from using the app.",
    icon: BanIcon,
  },
  suspended: {
    title: "Your access is suspended",
    description: "An app administrator has temporarily suspended your access.",
    icon: UserRoundXIcon,
  },
  removed: {
    title: "You don't have access",
    description: "Your account no longer has access to this app.",
    icon: ShieldXIcon,
  },
  missing: {
    title: "You don't have access yet",
    description: "Request access to continue to this app.",
    icon: UserRoundXIcon,
  },
  access_denied: {
    title: "You don't have access",
    description: "This account cannot access the app.",
    icon: ShieldXIcon,
  },
  permission_denied: {
    title: "You don't have access to this page",
    description:
      "Your current role does not include the permission required here.",
    icon: LockKeyholeIcon,
  },
  mirror_not_ready: {
    title: "Preparing your access",
    description:
      "Your access is still being prepared. This usually takes a moment.",
    icon: Clock3Icon,
  },
  error: {
    title: "Something went wrong",
    description: "We couldn't load this page. Please try again.",
    icon: ShieldXIcon,
  },
};

interface IamAccessStateViewProps {
  actionFailed?: boolean;
  isChecking?: boolean;
  isSigningOut?: boolean;
  onCheckAgain?: () => Promise<void> | void;
  onGoBack?: () => void;
  onRetry?: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  state: IamAccessState;
}

export function IamAccessStateView({
  actionFailed = false,
  isChecking = false,
  isSigningOut = false,
  onCheckAgain,
  onGoBack,
  onRetry,
  onSignOut,
  state,
}: IamAccessStateViewProps) {
  const content = ACCESS_STATE_CONTENT[state];
  const Icon = content.icon;
  const isBusy = isChecking || isSigningOut;
  const primaryAction =
    (state === "pending_approval" || state === "missing") && onCheckAgain
      ? {
          label: isChecking ? "Checking..." : "Check again",
          onClick: onCheckAgain,
        }
      : state === "permission_denied" && onGoBack
        ? { label: "Go back", onClick: onGoBack }
        : (state === "mirror_not_ready" || state === "error") && onRetry
          ? { label: "Try again", onClick: onRetry }
          : null;

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <Empty className="max-w-lg border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <h1>{content.title}</h1>
          </EmptyTitle>
          <EmptyDescription>{content.description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {actionFailed && (
            <p className="text-sm text-destructive" role="alert">
              We couldn't complete that action. Please try again.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant={primaryAction ? "secondary" : "default"}
              disabled={isBusy}
              onClick={() => void onSignOut()}
            >
              {isSigningOut && <Spinner />}
              <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
            </Button>
            {primaryAction && (
              <Button
                type="button"
                disabled={isBusy}
                onClick={() => void primaryAction.onClick()}
              >
                {isChecking && <Spinner />}
                <span>{primaryAction.label}</span>
              </Button>
            )}
          </div>
        </EmptyContent>
      </Empty>
    </main>
  );
}

// ── /auth/* routed access pages ────────────────────────────────────────────────

export type AuthAccessState = Extract<
  IamAccessState,
  | "pending_approval"
  | "blocked"
  | "suspended"
  | "removed"
  | "missing"
  | "access_denied"
>;

const AUTH_ACCESS_PATHS = [
  ["pending_approval", "pending-approval"],
  ["blocked", "blocked"],
  ["suspended", "suspended"],
  ["removed", "removed"],
  ["missing", "missing"],
  ["access_denied", "access-denied"],
] as const satisfies ReadonlyArray<readonly [AuthAccessState, string]>;

type AuthAccessPath = (typeof AUTH_ACCESS_PATHS)[number][1];

/** The /auth/<segment> for an access status; unknown statuses are denied. */
// eslint-disable-next-line react-refresh/only-export-components
export function getAuthAccessPath(status: string | undefined): AuthAccessPath {
  return (
    AUTH_ACCESS_PATHS.find(([state]) => state === status)?.[1] ??
    "access-denied"
  );
}

/** The full /auth/* pathname for an access status. */
// eslint-disable-next-line react-refresh/only-export-components
export function getAuthAccessRoute(status: string | undefined): string {
  return `/auth/${getAuthAccessPath(status)}`;
}

/** Whether a /auth/<segment> names one of the access-state pages. */
// eslint-disable-next-line react-refresh/only-export-components
export function isAuthAccessPath(path: string | undefined): boolean {
  return AUTH_ACCESS_PATHS.some(([, route]) => route === path);
}

function getAuthAccessState(path: string | undefined): AuthAccessState | null {
  return AUTH_ACCESS_PATHS.find(([, route]) => route === path)?.[0] ?? null;
}

function isAuthAccessPathname(pathname: string): boolean {
  const match = /^\/auth\/([^/]+)\/?$/.exec(pathname);
  return match !== null && isAuthAccessPath(match[1]);
}

/**
 * The /auth/$state route element: renders the access state named by the path
 * segment. The route's `beforeLoad` already 404s unknown segments; this
 * renders nothing for them as a second line of defense.
 */
export function IamAccessRoute({ path }: { path: string }) {
  const state = getAuthAccessState(path);

  return state ? <ResolvedIamAccessRoute state={state} /> : null;
}

function ResolvedIamAccessRoute({ state }: { state: AuthAccessState }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const evaluateAccess = useAction(api.iam.evaluateAccess);
  const [isChecking, setIsChecking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const handleCheckAgain = useCallback(async () => {
    setIsChecking(true);
    setActionFailed(false);
    try {
      const result = await evaluateAccess({});
      if (result.allowed) {
        await navigate({ to: "/", replace: true });
      } else {
        await navigate({
          to: "/auth/$state",
          params: { state: getAuthAccessPath(result.status) },
          replace: true,
        });
      }
    } catch {
      setActionFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, [evaluateAccess, navigate]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setActionFailed(false);
    try {
      await signOut();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signOut]);

  return (
    <IamAccessStateView
      state={state}
      actionFailed={actionFailed}
      isChecking={isChecking}
      isSigningOut={isSigningOut}
      onCheckAgain={
        state === "pending_approval" || state === "missing"
          ? handleCheckAgain
          : undefined
      }
      onSignOut={handleSignOut}
    />
  );
}

// ── signed-in route gating ─────────────────────────────────────────────────────

/**
 * Wrap signed-in route subtrees in this. Renders children immediately while
 * auth resolves (no loading screen; data queries are auth-gated). With no
 * session at all it redirects to "/" right away; when a session existed in
 * this mount and disappears, the redirect waits out the grace window so a
 * refresh blip never bounces users. The session is seeded from SSR, so on a
 * server render a signed-out user gets the redirect as soon as the page
 * hydrates (`Navigate` runs on the client).
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const signedOut = !loading && user === null;
  const [hadSession, setHadSession] = useState(user !== null);
  const [trackedSignedOut, setTrackedSignedOut] = useState(signedOut);
  const [graceElapsed, setGraceElapsed] = useState(false);

  if (user !== null && !hadSession) {
    setHadSession(true);
  }
  // Restart the grace window whenever the signed-out state flips.
  if (trackedSignedOut !== signedOut) {
    setTrackedSignedOut(signedOut);
    setGraceElapsed(false);
  }

  useEffect(() => {
    if (!signedOut) return;
    const timer = setTimeout(
      () => setGraceElapsed(true),
      SIGNED_OUT_REDIRECT_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [signedOut]);

  // No stored session, no refresh in flight: nothing to wait for.
  const definitivelySignedOut = signedOut && !hadSession;

  if (definitivelySignedOut || (signedOut && graceElapsed)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// ── deployment entry ───────────────────────────────────────────────────────────

const ENTRY_STORAGE_PREFIX = "hercules-iam:entered:";
const entryInFlight = new Set<string>();

function hasEnteredSession(key: string): boolean {
  try {
    return window.sessionStorage.getItem(ENTRY_STORAGE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function rememberEnteredSession(key: string) {
  try {
    window.sessionStorage.setItem(ENTRY_STORAGE_PREFIX + key, "1");
  } catch {
    // Storage unavailable (private mode, quota): entry simply re-runs next
    // load; access.enter is idempotent.
  }
}

/**
 * Deployment entry: once per session, as soon as the Convex client is
 * authenticated, ask IAM to admit the signed-in user into the primary tenant
 * (the tenant's access mode decides admit / pending / deny). Nothing blocks
 * while it runs; a denial routes to the matching /auth/* page, and an approval
 * discovered while sitting on one of those pages sends the user home.
 * Failures are left to the reactive queries and the error boundary.
 */
function DeploymentEntry() {
  const { user, sessionId } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const evaluateAccess = useAction(api.iam.evaluateAccess);
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !isAuthenticated) return;
    const key = sessionId ?? userId;
    if (hasEnteredSession(key) || entryInFlight.has(key)) return;

    let active = true;
    entryInFlight.add(key);
    evaluateAccess({}).then(
      (result) => {
        entryInFlight.delete(key);
        rememberEnteredSession(key);
        if (!active) return;
        const onAccessPage = isAuthAccessPathname(window.location.pathname);
        if (result.allowed && onAccessPage) {
          void navigate({ to: "/", replace: true });
        } else if (!result.allowed && !onAccessPage) {
          void navigate({
            to: "/auth/$state",
            params: { state: getAuthAccessPath(result.status) },
            replace: true,
          });
        }
      },
      () => {
        entryInFlight.delete(key);
      },
    );

    return () => {
      active = false;
    };
  }, [evaluateAccess, isAuthenticated, navigate, sessionId, userId]);

  return null;
}

// ── the provider (access error boundary + watchdog) ────────────────────────────

type IamOperationErrorHandler = (error: unknown) => boolean;
type IamAdmissionStatus =
  "pending_approval" | "blocked" | "suspended" | "removed" | "missing";
type IamPrincipalStatus = Exclude<IamAdmissionStatus, "missing"> | "active";

const IamOperationErrorContext = createContext<IamOperationErrorHandler>(
  () => false,
);

/**
 * Handler for IAM errors thrown by mutations/actions called from event
 * handlers (the boundary only sees render errors). Returns true when the
 * error was an IAM access error and has been handled (toast or access page).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useIamOperationError() {
  return useContext(IamOperationErrorContext);
}

export function HerculesIAM({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <IamRenderErrorBoundary resetKey={location.href}>
      <DeploymentEntry />
      {children}
    </IamRenderErrorBoundary>
  );
}

interface IamRenderErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface IamRenderErrorBoundaryState {
  classification: AccessErrorClassification | null;
  hasError: boolean;
}

class IamRenderErrorBoundary extends Component<
  IamRenderErrorBoundaryProps,
  IamRenderErrorBoundaryState
> {
  state: IamRenderErrorBoundaryState = {
    classification: null,
    hasError: false,
  };

  // Watchdog bookkeeping for TEMPORARY (mirror still syncing) errors.
  private temporarySince: number | null = null;
  private watchdogToastFired = false;
  private clearTemporaryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: unknown): IamRenderErrorBoundaryState {
    return {
      classification: classifyAccessError(error),
      hasError: true,
    };
  }

  override componentDidUpdate(previousProps: IamRenderErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.reset();
    }
    if (this.state.hasError) {
      if (this.clearTemporaryTimer) {
        clearTimeout(this.clearTemporaryTimer);
        this.clearTemporaryTimer = null;
      }
    } else if (this.temporarySince !== null && !this.clearTemporaryTimer) {
      // Rendering again: after stable success, reset the watchdog window.
      this.clearTemporaryTimer = setTimeout(() => {
        this.temporarySince = null;
        this.watchdogToastFired = false;
        this.clearTemporaryTimer = null;
      }, 4_000);
    }
  }

  override componentWillUnmount() {
    if (this.clearTemporaryTimer) clearTimeout(this.clearTemporaryTimer);
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    const classification = classifyAccessError(error);
    if (!classification) {
      console.error("Unhandled application error", error, info);
      return;
    }
    if (classification.kind === "temporary" && this.temporarySince === null) {
      this.temporarySince = Date.now();
    }
  }

  override render() {
    return (
      <IamOperationErrorContext.Provider value={this.handleOperationError}>
        {this.state.hasError ? (
          this.state.classification ? (
            this.state.classification.kind === "admission" ? (
              <Navigate
                to="/auth/$state"
                params={{
                  state: getAuthAccessPath(this.state.classification.status),
                }}
                replace
              />
            ) : this.state.classification.kind === "temporary" ? (
              <TemporaryAccessRecovery
                sinceMs={this.temporarySince ?? Date.now()}
                onFirstToast={this.markWatchdogToastFired}
                toastAlreadyFired={this.watchdogToastFired}
                onReset={this.reset}
              />
            ) : (
              <ClassifiedIamFallback
                classification={this.state.classification}
                onReset={this.reset}
              />
            )
          ) : (
            <GenericErrorFallback onReset={this.reset} />
          )
        ) : (
          this.props.children
        )}
      </IamOperationErrorContext.Provider>
    );
  }

  private markWatchdogToastFired = () => {
    this.watchdogToastFired = true;
  };

  private handleOperationError = (error: unknown) => {
    const classification = classifyAccessError(error);
    if (!classification) return false;

    if (classification.kind === "permission") {
      toast.error("You don't have permission to do that.");
    } else {
      this.setState({ classification, hasError: true });
    }
    return true;
  };

  private reset = () => {
    this.setState({ classification: null, hasError: false });
  };
}

/**
 * TEMPORARY (still-syncing) access errors: render nothing and silently retry;
 * after the watchdog window, surface the access page plus a toast naming
 * Hercules IAM so slow syncs are reportable.
 */
function TemporaryAccessRecovery({
  sinceMs,
  onFirstToast,
  toastAlreadyFired,
  onReset,
}: {
  sinceMs: number;
  onFirstToast: () => void;
  toastAlreadyFired: boolean;
  onReset: () => void;
}) {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [watchdogTripped, setWatchdogTripped] = useState(false);

  // The boundary keeps `sinceMs` across retries, so each retry cycle arms the
  // watchdog with the remaining budget; once it is shorter than a retry, the
  // watchdog fires before the next reset.
  useEffect(() => {
    const remainingMs = Math.max(
      0,
      ACCESS_WATCHDOG_MS - (Date.now() - sinceMs),
    );
    const timer = setTimeout(() => setWatchdogTripped(true), remainingMs);
    return () => clearTimeout(timer);
  }, [sinceMs]);

  useEffect(() => {
    if (watchdogTripped) {
      if (!toastAlreadyFired) {
        onFirstToast();
        toast.error(
          "Hercules IAM is taking longer than expected to prepare your access.",
          {
            description: "You can retry, or contact support if this persists.",
          },
        );
        console.error(
          `[hercules-iam] Access still syncing after ${ACCESS_WATCHDOG_MS}ms; surfacing the access page.`,
        );
      }
      return;
    }
    const timer = setTimeout(onReset, TEMPORARY_RETRY_MS);
    return () => clearTimeout(timer);
  }, [watchdogTripped, toastAlreadyFired, onFirstToast, onReset]);

  if (!watchdogTripped) return null;

  return (
    <IamAccessStateView
      state="mirror_not_ready"
      isSigningOut={isSigningOut}
      onRetry={onReset}
      onSignOut={async () => {
        setIsSigningOut(true);
        try {
          await signOut();
        } finally {
          setIsSigningOut(false);
        }
      }}
    />
  );
}

function ClassifiedIamFallback({
  classification,
  onReset,
}: {
  classification: AccessErrorClassification;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const { signOut } = useAuth();
  const evaluateAccess = useAction(api.iam.evaluateAccess);
  const tenantAccessStatus = useQuery(api.iam.getTenantAccessStatus);
  const [checkedAccessState, setCheckedAccessState] =
    useState<IamAdmissionStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const mirrorState = stateFromTenantAccessStatus(tenantAccessStatus);
  const missingMirrorState =
    tenantAccessStatus?.kind === "fallback" &&
    tenantAccessStatus.reason === "membership_missing" &&
    (classification.kind !== "admission" || classification.status === "missing")
      ? "missing"
      : null;
  const displayState =
    mirrorState ??
    checkedAccessState ??
    missingMirrorState ??
    stateFromClassification(classification);

  useEffect(() => {
    if (!tenantAccessStatus) return;

    if (tenantAccessStatus.kind === "principal") {
      if (tenantAccessStatus.status === "active") {
        if (
          classification.kind !== "permission" ||
          (classification.sourceVersion !== undefined &&
            tenantAccessStatus.stateVersion !== classification.sourceVersion)
        ) {
          onReset();
        }
        return;
      }
      return;
    }

    if (
      classification.kind === "temporary" &&
      tenantAccessStatus.reason !== "mirror_not_ready"
    ) {
      onReset();
      return;
    }
  }, [classification, tenantAccessStatus, onReset]);

  const handleCheckAgain = useCallback(async () => {
    setIsChecking(true);
    setActionFailed(false);
    try {
      const result = await evaluateAccess({});
      if (result.allowed || result.status === "active") {
        onReset();
      } else {
        setCheckedAccessState(accessStateFromStatus(result.status));
      }
    } catch {
      setActionFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, [evaluateAccess, onReset]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setActionFailed(false);
    try {
      await signOut();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signOut]);

  const handleGoBack = useCallback(() => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: "/", replace: true });
    }
  }, [navigate, router]);

  return (
    <IamAccessStateView
      state={displayState}
      actionFailed={actionFailed}
      isChecking={isChecking}
      isSigningOut={isSigningOut}
      onCheckAgain={
        displayState === "pending_approval" || displayState === "missing"
          ? handleCheckAgain
          : undefined
      }
      onGoBack={displayState === "permission_denied" ? handleGoBack : undefined}
      onSignOut={handleSignOut}
    />
  );
}

function GenericErrorFallback({ onReset }: { onReset: () => void }) {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setActionFailed(false);
    try {
      await signOut();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signOut]);

  return (
    <IamAccessStateView
      state="error"
      actionFailed={actionFailed}
      isSigningOut={isSigningOut}
      onRetry={onReset}
      onSignOut={handleSignOut}
    />
  );
}

function stateFromClassification(
  classification: AccessErrorClassification,
): IamAccessState {
  if (classification.kind === "admission") return classification.status;
  if (classification.kind === "permission") return "permission_denied";
  return "mirror_not_ready";
}

function stateFromTenantAccessStatus(
  accessStatus:
    | {
        kind: "principal";
        status: IamPrincipalStatus;
      }
    | {
        kind: "fallback";
        reason: string;
      }
    | undefined,
): IamAdmissionStatus | null {
  if (!accessStatus || accessStatus.kind !== "principal") return null;
  return accessStatus.status === "active" ? null : accessStatus.status;
}

function accessStateFromStatus(
  status: IamAdmissionStatus | "active" | undefined,
): IamAdmissionStatus {
  return status && status !== "active" ? status : "missing";
}
