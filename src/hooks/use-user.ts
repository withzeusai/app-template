import { useEffect } from "react";

import { useAuth } from "./use-auth";

type UseUserProps = {
  /**
   * The method to automatically sign in the user if they are not authenticated
   */
  or?: "redirect";
};

export function useUser({ or }: UseUserProps) {
  const { user, isLoading, error, isAuthenticated, signinRedirect } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && or === "redirect") {
      signinRedirect();
    }
  }, [isLoading, isAuthenticated, or, signinRedirect]);

  const id = user?.profile.sub;
  const name = user?.profile.name;
  const email = user?.profile.email;
  const avatar = user?.profile.picture;
  return { id, name, email, avatar, ...(user ?? {}), isLoading, error };
}
