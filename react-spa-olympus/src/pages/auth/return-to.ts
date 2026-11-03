/**
 * The in-app path `signin()` stored in the OIDC state, when it is safe to
 * follow: a same-origin path, and not this callback page itself.
 */
export function resolveReturnTo(state: unknown): string {
  if (typeof state !== "object" || state === null || !("returnTo" in state)) {
    return "/";
  }
  const { returnTo } = state;
  if (typeof returnTo !== "string" || !returnTo.startsWith("/")) return "/";
  if (returnTo.startsWith("//") || returnTo.startsWith("/\\")) return "/";
  if (returnTo.startsWith("/auth/callback")) return "/";
  return returnTo;
}
