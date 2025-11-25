import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, hasAuthParams } from "@usehercules/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";

const TIMEOUT_MS = 20000; // 20 second timeout

type AuthStatus =
  | "processing-oauth" // OIDC is processing the callback
  | "waiting-convex" // Waiting for Convex to authenticate
  | "creating-user" // Creating/updating user in Convex
  | "success" // All done, redirecting
  | "error"; // Something went wrong

export default function AuthCallback() {
  const navigate = useNavigate();
  const {
    isLoading: isAuthLoading,
    isAuthenticated: isOidcAuthenticated,
    error: oidcError,
    signinRedirect,
  } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const [status, setStatus] = useState<AuthStatus>("processing-oauth");
  const [authError, setAuthError] = useState<string | null>(null);

  // Track mount state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track if we had auth params on mount (won't change during lifecycle)
  const hadAuthParams = useRef(hasAuthParams());
  // Track if we've already started user creation to prevent double execution
  const userCreationStarted = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Timeout protection with state awareness
  useEffect(() => {
    if (status === "success" || status === "error") return;

    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setStatus("error");
        setAuthError("Authentication timed out. Please try again.");
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [status]);

  // Track OIDC → Convex authentication progression
  useEffect(() => {
    // Don't update if we're already past processing or in an error state
    if (status !== "processing-oauth" && status !== "waiting-convex") return;

    // Handle OIDC errors
    if (oidcError) {
      setStatus("error");
      setAuthError(oidcError.message || "Authentication failed");
      return;
    }

    // No auth params and not authenticated - navigated here directly
    if (!hadAuthParams.current && !isAuthLoading && !isOidcAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    // OIDC is done loading and authenticated - move to waiting for Convex
    if (
      !isAuthLoading &&
      isOidcAuthenticated &&
      status === "processing-oauth"
    ) {
      setStatus("waiting-convex");
      return;
    }

    // OIDC finished but not authenticated (and we had auth params)
    // Wait a bit before declaring failure to avoid race conditions
    if (
      hadAuthParams.current &&
      !isAuthLoading &&
      !isOidcAuthenticated &&
      !oidcError &&
      status === "processing-oauth"
    ) {
      // Use a small delay to avoid race condition during OIDC state transitions
      const failureTimeout = setTimeout(() => {
        if (mountedRef.current && !isOidcAuthenticated) {
          setStatus("error");
          setAuthError(
            "Authentication was cancelled or failed. Please try again.",
          );
        }
      }, 500);

      return () => clearTimeout(failureTimeout);
    }
  }, [isAuthLoading, isOidcAuthenticated, oidcError, status, navigate]);

  // Create user in Convex once Convex is authenticated
  useEffect(() => {
    if (status !== "waiting-convex" || !isConvexAuthenticated) return;
    if (userCreationStarted.current) return;

    userCreationStarted.current = true;

    async function createUser() {
      if (!mountedRef.current) return;

      setStatus("creating-user");

      try {
        await updateCurrentUser();

        if (mountedRef.current) {
          setStatus("success");
        }
      } catch (err) {
        console.error("Failed to create user:", err);

        if (!mountedRef.current) return;

        // Check if it's an authentication error from Convex
        const errorMessage =
          err instanceof Error && err.message.includes("UNAUTHENTICATED")
            ? "Your session expired. Please sign in again."
            : "Failed to set up your account. Please try again.";

        setStatus("error");
        setAuthError(errorMessage);
      }
    }

    createUser();
  }, [status, isConvexAuthenticated, updateCurrentUser]);

  // Handle successful completion - redirect home
  useEffect(() => {
    if (status === "success") {
      navigate("/", { replace: true });
    }
  }, [status, navigate]);

  // Retry handler
  const handleRetry = useCallback(async () => {
    try {
      await signinRedirect();
    } catch (err) {
      console.error("Failed to restart auth:", err);
    }
  }, [signinRedirect]);

  // Show error state
  if (status === "error" && authError) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md">{authError}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/", { replace: true })}
          >
            Return home
          </Button>
          <Button onClick={handleRetry}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
