import { HerculesAuthProvider } from "@usehercules/auth-tanstack/client";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";

/** `initialAuth` comes from SSR, so `useAuth()` is correct in the server HTML. */
export default function AuthProvider({
  initialAuth,
  children,
}: {
  initialAuth?: ClientUserInfo | NoUserInfo;
  children: React.ReactNode;
}) {
  return (
    <HerculesAuthProvider initialAuth={initialAuth}>
      {children}
    </HerculesAuthProvider>
  );
}
