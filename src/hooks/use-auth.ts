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
    async ({ forceRefreshToken: _todo }: { forceRefreshToken: boolean }) => {
      // todo: refresh token if needed
      return idToken ?? null;
    },
    [idToken],
  );

  const a = useMemo(() => {
    return {
      ...oidcAuth,
      fetchAccessToken,
    };
  }, [oidcAuth, fetchAccessToken]);

  return a;
}
