import { HerculesAuthProvider, type HerculesAuthProviderProps } from "@usehercules/auth/react";

const AUTH_CONFIG: HerculesAuthProviderProps = {
  authority:
    import.meta.env.VITE_HERCULES_OIDC_AUTHORITY ?? "https://hercules.app",
  client_id: import.meta.env.VITE_HERCULES_OIDC_CLIENT_ID ?? "",
  prompt: import.meta.env.VITE_HERCULES_OIDC_PROMPT,
  response_type: import.meta.env.VITE_HERCULES_OIDC_RESPONSE_TYPE,
  scope: import.meta.env.VITE_HERCULES_OIDC_SCOPE,
  redirect_uri: import.meta.env.VITE_HERCULES_OIDC_REDIRECT_URI,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <HerculesAuthProvider {...AUTH_CONFIG}>{children}</HerculesAuthProvider>
  );
}
