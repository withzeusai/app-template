import { useAuth as useOidcAuth } from "react-oidc-context";

type UseAuthHook = {
  fetchAccessToken: (args: {
    forceRefreshToken: boolean;
  }) => Promise<string | null>;
} & ReturnType<typeof useOidcAuth>;

export function useAuth(): UseAuthHook {
  const oidcAuth = useOidcAuth();
  return {
    ...oidcAuth,
    fetchAccessToken: async ({ forceRefreshToken }) => {
      if (forceRefreshToken) {
        const user = await oidcAuth.signinSilent();
        return user?.access_token ?? null;
      } else {
        return oidcAuth.user?.access_token ?? null;
      }
    },
  };
}
