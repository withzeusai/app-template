import { HerculesAuthProvider } from "@usehercules/auth-tanstack/client";

/**
 * Provides reactive auth state (`useAuth`, `useAccessToken`, …) to the tree.
 *
 * OIDC configuration now lives server-side (the `HERCULES_AUTH_*` env vars); the
 * provider just reads the sealed session cookie via server functions, so there
 * is nothing to configure here. It is SSR-safe — the session is fetched in a
 * client effect after hydration.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <HerculesAuthProvider>{children}</HerculesAuthProvider>;
}
