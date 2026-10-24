/**
 * Security headers for every response the app's server sends. Hercules does
 * not add these to published apps.
 *
 * `Strict-Transport-Security` and `X-Frame-Options` are left out on purpose.
 * Hercules adds them from the app's Security settings, and only to responses
 * that do not already carry them, so setting them here would override those
 * settings. The builder preview also embeds the app in an iframe. Static files
 * from `public/` are served before this code runs and do not get these.
 */
const SECURITY_HEADERS: ReadonlyArray<[name: string, value: string]> = [
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
];

/** `response` with any missing {@link SECURITY_HEADERS} added. */
export function withSecurityHeaders(response: Response): Response {
  const missing = SECURITY_HEADERS.filter(
    ([name]) => !response.headers.has(name),
  );
  // A 1xx response (a protocol upgrade) cannot be rebuilt.
  if (missing.length === 0 || response.status < 200) return response;
  // Some responses (`Response.redirect()`, `fetch()` results) have immutable
  // headers; a copy does not.
  const secured = new Response(response.body, response);
  for (const [name, value] of missing) secured.headers.set(name, value);
  return secured;
}
