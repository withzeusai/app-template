import { ConvexProviderWithHerculesAuth } from "@usehercules/auth/convex-react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { AuthProvider } from "./auth.tsx";

/**
 * Wires the Convex client into the app.
 *
 * Hercules auth is client-only: OIDC tokens live in the browser and the
 * underlying UserManager touches `window` at construction. So on the server we
 * render a plain `ConvexProvider` (public/unauthenticated queries can still
 * SSR), and the auth wiring only mounts on the client. The same Convex client
 * instance is used in both environments, so hydration is seamless.
 */
export function ConvexAppProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: React.ReactNode;
}) {
  if (typeof window === "undefined") {
    return <ConvexProvider client={client}>{children}</ConvexProvider>;
  }

  return (
    <AuthProvider>
      <ConvexProviderWithHerculesAuth client={client}>
        {children}
      </ConvexProviderWithHerculesAuth>
    </AuthProvider>
  );
}
