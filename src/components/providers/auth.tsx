import { HerculesAuthProvider } from "@usehercules/auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <HerculesAuthProvider
      authority={import.meta.env.VITE_HERCULES_OIDC_AUTHORITY!}
      client_id={import.meta.env.VITE_HERCULES_OIDC_CLIENT_ID!}
      userManagerSettings={{
        prompt:
          import.meta.env.VITE_HERCULES_OIDC_PROMPT ??
          (process.env.NODE_ENV === "production" ? "login" : undefined),
        response_type:
          import.meta.env.VITE_HERCULES_OIDC_RESPONSE_TYPE ?? "code",
        scope:
          import.meta.env.VITE_HERCULES_OIDC_SCOPE ??
          "openid profile email offline_access",
        redirect_uri:
          import.meta.env.VITE_HERCULES_OIDC_REDIRECT_URI ??
          `${window.location.origin}/auth/callback`,
        post_logout_redirect_uri:
          import.meta.env.VITE_HERCULES_OIDC_POST_LOGOUT_REDIRECT_URI ??
          window.location.origin,
      }}
    >
      {children}
    </HerculesAuthProvider>
  );
}
