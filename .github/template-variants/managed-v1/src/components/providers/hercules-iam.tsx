// HerculesIAM - ALL Hercules IAM access UI in one file: the provider (access
// error boundary + watchdog), signed-in gating (RequireSignIn), the /auth/*
// pages (IamAccessRoute), and the access-state screens. Wired once in
// providers/default.tsx and App.tsx; apps never need to read or modify it.
// Rule (follow it in app code too): never block rendering behind a loading
// screen. Render the shell; access problems surface as routed pages or a toast.

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
import { useAuth } from "@usehercules/auth/react";
import {
  classifyAccessError,
  type AccessErrorClassification,
} from "@usehercules/convex";
import { useAction, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  Clock3Icon,
  LockKeyholeIcon,
  ShieldXIcon,
  UserRoundXIcon,
} from "lucide-react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
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
import NotFound from "@/pages/NotFound.tsx";

// Signed-out must persist this long before redirecting: token refreshes can
// flicker auth to signed-out for a moment.
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

export function getAuthAccessRoute(status: string | undefined): string {
  const path = AUTH_ACCESS_PATHS.find(([state]) => state === status)?.[1];

  return `/auth/${path ?? "access-denied"}`;
}

function getAuthAccessState(path: string | undefined): AuthAccessState | null {
  return AUTH_ACCESS_PATHS.find(([, route]) => route === path)?.[0] ?? null;
}

/** The /auth/* route element: renders the access state named by the path. */
export function IamAccessRoute() {
  const state = getAuthAccessState(useParams<"*">()["*"]);

  return state ? <ResolvedIamAccessRoute state={state} /> : <NotFound />;
}

function ResolvedIamAccessRoute({ state }: { state: AuthAccessState }) {
  const navigate = useNavigate();
  const { signout } = useAuth();
  const evaluateAccess = useAction(api.iam.evaluateAccess);
  const [isChecking, setIsChecking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const handleCheckAgain = useCallback(async () => {
    setIsChecking(true);
    setActionFailed(false);
    try {
      const result = await evaluateAccess({});
      navigate(result.allowed ? "/" : getAuthAccessRoute(result.status), {
        replace: true,
      });
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
      await signout();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signout]);

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
 * auth resolves (no loading screen; data queries are auth-gated). No session
 * at all redirects to "/" right away; with a stored session the redirect
 * waits out the grace window so renewal blips never bounce users. The
 * redirect carries the attempted URL in router state as { returnTo } so a
 * landing page's sign-in button can send users back via signin({ returnTo }).
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const signedOut = !auth.isLoading && !auth.isAuthenticated;
  // No stored session, no renewal in flight: nothing to wait for.
  const definitivelySignedOut =
    signedOut && auth.user == null && auth.activeNavigator === undefined;
  const [confirmedSignedOut, setConfirmedSignedOut] = useState(false);

  useEffect(() => {
    if (!signedOut) {
      setConfirmedSignedOut(false);
      return;
    }
    const timer = setTimeout(
      () => setConfirmedSignedOut(true),
      SIGNED_OUT_REDIRECT_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [signedOut]);

  if (definitivelySignedOut || (signedOut && confirmedSignedOut)) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          returnTo: location.pathname + location.search + location.hash,
        }}
      />
    );
  }
  return children;
}

// ── the provider (access error boundary + watchdog) ────────────────────────────

type IamOperationErrorHandler = (error: unknown) => boolean;
type IamAdmissionStatus =
  "pending_approval" | "blocked" | "suspended" | "removed" | "missing";
type IamPrincipalStatus = Exclude<IamAdmissionStatus, "missing"> | "active";

const IamOperationErrorContext = createContext<IamOperationErrorHandler>(
  () => false,
);

// eslint-disable-next-line react-refresh/only-export-components
export function useIamOperationError() {
  return useContext(IamOperationErrorContext);
}

export function HerculesIAM({ children }: { children: ReactNode }) {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}${location.hash}`;

  return (
    <IamRenderErrorBoundary resetKey={resetKey}>
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
                to={getAuthAccessRoute(this.state.classification.status)}
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
  const { signout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const elapsedMs = Date.now() - sinceMs;
  const watchdogTripped = elapsedMs >= ACCESS_WATCHDOG_MS;

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
          await signout();
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
  const { signout } = useAuth();
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
      await signout();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signout]);

  const handleGoBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

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
  const { signout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setActionFailed(false);
    try {
      await signout();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signout]);

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
