import { useRouter } from "@tanstack/react-router";
import { AUTH_ERROR_PARAM } from "@usehercules/auth-tanstack";
import { useEffect } from "react";
import { toast } from "sonner";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  sign_in_expired: "That sign-in expired. Please sign in again.",
};

/** Toasts why a sign-in failed (`?auth_error=`), then drops it from the URL. */
export function useAuthErrorToast(signedIn: boolean) {
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    const reason = url.searchParams.get(AUTH_ERROR_PARAM);
    if (reason === null) return;
    // A reloaded callback can land here already signed in: nothing to report.
    if (!signedIn) {
      toast.error(
        AUTH_ERROR_MESSAGES[reason] ??
          "Sign-in didn't complete. Please try again.",
      );
    }
    url.searchParams.delete(AUTH_ERROR_PARAM);
    router.history.replace(url.pathname + url.search + url.hash);
  }, [router, signedIn]);
}
