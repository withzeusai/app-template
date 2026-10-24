// Any origin works: it only anchors the parse, and anything that resolves
// elsewhere is rejected.
const BASE = "https://app.invalid";

/**
 * The in-app path to return to after sign-in, when it is safe to follow: a
 * same-origin path, and not one of the auth routes themselves.
 *
 * The value is parsed the way a browser would read it as a `Location`, which
 * drops tabs and newlines and treats `\` as `/`, so `/\t/evil.com` is caught
 * as `//evil.com`. The normalized path is returned, never the raw input.
 */
export function resolveReturnTo(returnTo: string | null): string {
  if (returnTo === null || !returnTo.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(returnTo, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  const path = `${url.pathname}${url.search}${url.hash}`;
  // `/.//evil.com` normalizes to a path that a browser would read as a host.
  if (path.startsWith("//")) return "/";
  if (path.toLowerCase().startsWith("/auth/")) return "/";
  return path;
}
