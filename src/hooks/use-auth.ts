import { useAuth } from "@usehercules/auth-tanstack/client";

export { useAuth };

/** The authenticated user (or `null` when signed out), from {@link useAuth}. */
export function useUser() {
  return useAuth().user;
}
