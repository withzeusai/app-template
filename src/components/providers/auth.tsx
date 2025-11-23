import { HerculesAuthProvider } from "@usehercules/auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <HerculesAuthProvider
      authority={import.meta.env.VITE_HERCULES_OIDC_AUTHORITY!}
      client_id={import.meta.env.VITE_HERCULES_OIDC_CLIENT_ID!}
    >
      {children}
    </HerculesAuthProvider>
  );
}
