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
  classifyIamError,
  type IamErrorClassification,
} from "@usehercules/convex";
import { useAction, useQuery } from "convex/react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import {
  IamAccessStateView,
  type IamAccessState,
} from "@/components/iam/access-state.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { getAuthAccessRoute } from "@/pages/auth/access-routes.ts";

type IamOperationErrorHandler = (error: unknown) => boolean;
type IamAdmissionStatus =
  | "pending_approval"
  | "blocked"
  | "suspended"
  | "removed"
  | "missing";
type IamPrincipalStatus = Exclude<IamAdmissionStatus, "missing"> | "active";

const IamOperationErrorContext = createContext<IamOperationErrorHandler>(
  () => false,
);

// eslint-disable-next-line react-refresh/only-export-components
export function useIamOperationError() {
  return useContext(IamOperationErrorContext);
}

export function IamAccessBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}${location.hash}`;

  return (
    <IamRenderErrorBoundary resetKey={resetKey}>
      {children}
    </IamRenderErrorBoundary>
  );
}

function IamAccessLoadingState() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner className="size-8" />
    </main>
  );
}

interface IamRenderErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface IamRenderErrorBoundaryState {
  classification: IamErrorClassification | null;
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

  static getDerivedStateFromError(error: unknown): IamRenderErrorBoundaryState {
    return {
      classification: classifyIamError(error),
      hasError: true,
    };
  }

  override componentDidUpdate(previousProps: IamRenderErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.reset();
    }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (!classifyIamError(error)) {
      console.error("Unhandled application error", error, info);
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

  private handleOperationError = (error: unknown) => {
    const classification = classifyIamError(error);
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

function ClassifiedIamFallback({
  classification,
  onReset,
}: {
  classification: IamErrorClassification;
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
    tenantAccessStatus.reason === "principal_missing" &&
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

  if (displayState === "mirror_not_ready") {
    return <IamAccessLoadingState />;
  }

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
  classification: IamErrorClassification,
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
