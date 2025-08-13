import { useCallback, useMemo } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";

type UseAuthHook = {
  fetchAccessToken: (args: {
    forceRefreshToken: boolean;
  }) => Promise<string | null>;
} & ReturnType<typeof useOidcAuth>;

export function useAuth(): UseAuthHook {
  const oidcAuth = useOidcAuth();

  const idToken = oidcAuth.user?.id_token;
  const fetchAccessToken = useCallback(
    // eslint-disable-next-line no-empty-pattern
    async ({}: { forceRefreshToken: boolean }) => {
      // TODO: refresh token if needed
      return idToken ?? null;
    },
    [idToken],
  );

  return useMemo(
    () => ({
      ...oidcAuth,
      fetchAccessToken,
    }),
    [oidcAuth, fetchAccessToken],
  );
}
