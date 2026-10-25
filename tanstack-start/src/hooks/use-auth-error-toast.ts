import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { readAuthError } from "@/lib/auth-error.ts";

/**
 * Shows a toast when a failed sign-in sends the user back with `?auth_error=`,
 * then removes the parameter from the URL. A reloaded callback can land here
 * already signed in, so nothing is shown then.
 */
export function useAuthErrorToast(signedIn: boolean) {
  const router = useRouter();
  useEffect(() => {
    const authError = readAuthError(window.location.href);
    if (authError === null) return;
    if (!signedIn) toast.error(authError.message);
    router.history.replace(authError.cleanPath);
  }, [router, signedIn]);
}
