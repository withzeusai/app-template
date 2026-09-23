import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthCallback } from "@usehercules/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  authCallbackMessages,
  type AuthCallbackMessages,
} from "./callback-messages.ts";

interface AuthCallbackProps {
  messages?: AuthCallbackMessages;
}

export default function AuthCallback({
  messages = authCallbackMessages.en,
}: AuthCallbackProps): React.JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const onSync = useCallback(async () => {
    await updateCurrentUser();
  }, [updateCurrentUser]);

  const navigateHome = useCallback(
    () => navigate("/", { replace: true }),
    [navigate],
  );

  const { status, error, retry } = useAuthCallback({
    isBackendAuthenticated: isConvexAuthenticated,
    onSync,
    onSuccess: navigateHome,
    onNoAuthParams: navigateHome,
  });

  if (status === "error" && error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">{messages.errorTitle}</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {error === "No matching state found in storage"
              ? messages.missingState
              : error}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={navigateHome}>
            {messages.returnHome}
          </Button>
          <Button onClick={retry}>{messages.tryAgain}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" aria-label={messages.loading} />
      <p className="text-sm text-muted-foreground">{messages.loading}</p>
    </div>
  );
}
