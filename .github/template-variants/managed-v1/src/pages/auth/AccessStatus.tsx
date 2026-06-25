import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@usehercules/auth/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { IamAccessStateView } from "@/components/iam/access-state.tsx";
import NotFound from "../NotFound.tsx";
import {
  getAuthAccessRoute,
  getAuthAccessState,
  type AuthAccessState,
} from "./access-routes.ts";

export function AuthAccessStatus() {
  const state = getAuthAccessState(useParams<"*">()["*"]);

  return state ? <ResolvedAuthAccessStatus state={state} /> : <NotFound />;
}

function ResolvedAuthAccessStatus({ state }: { state: AuthAccessState }) {
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
