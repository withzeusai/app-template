import { useEffect } from "react";

import { useAuth } from "./use-auth";

type UseUserProps = {
  /**
   * Whether to automatically redirect to the login if the user is not authenticated
   */
  shouldRedirect?: boolean;
};

export function useUser({ shouldRedirect }: UseUserProps) {
  const { user, isLoading, error, isAuthenticated, signinRedirect,  } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && shouldRedirect) {
      signinRedirect();
    }
  }, [isLoading, isAuthenticated, shouldRedirect, signinRedirect]);

  const id = user?.profile.sub;
  const name = user?.profile.name;
  const email = user?.profile.email;
  const avatar = user?.profile.picture;
  return { id, name, email, avatar, ...(user ?? {}), isLoading, error };
}
