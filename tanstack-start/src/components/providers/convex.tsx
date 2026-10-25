import type { ConvexReactClient } from "convex/react";
import { ConvexProviderWithHerculesAuth } from "@usehercules/auth-tanstack/convex";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";
import AuthProvider from "./auth.tsx";

/**
 * Convex's `Authenticated` children only appear after hydration. For signed-in
 * content in the server HTML, load it with `convexQuery()` in a route loader
 * and gate UI on `useAuth().user`.
 */
export default function ConvexAppProvider({
  client,
  initialAuth,
  children,
}: {
  client: ConvexReactClient;
  initialAuth?: ClientUserInfo | NoUserInfo;
  children: React.ReactNode;
}) {
  return (
    <AuthProvider initialAuth={initialAuth}>
      <ConvexProviderWithHerculesAuth client={client}>
        {children}
      </ConvexProviderWithHerculesAuth>
    </AuthProvider>
  );
}
