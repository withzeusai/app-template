/** Opt in only URL-dependent, anonymous public HTML. Never call from the root route. */
export const PUBLIC_CACHE_POLICY_HEADER = "Hercules-CDN-Cache-Control";

export function publicHtmlCacheHeaders({
  freshSeconds = 60,
  staleSeconds = 120,
}: { freshSeconds?: number; staleSeconds?: number } = {}) {
  if (
    !Number.isInteger(freshSeconds) ||
    freshSeconds < 1 ||
    freshSeconds > 300 ||
    !Number.isInteger(staleSeconds) ||
    staleSeconds < 0 ||
    staleSeconds > 300
  )
    throw new RangeError(
      "Public HTML cache intervals must be bounded to 300 seconds",
    );
  return {
    [PUBLIC_CACHE_POLICY_HEADER]: `public, max-age=${freshSeconds}, stale-while-revalidate=${staleSeconds}`,
    "Cache-Control": "public, max-age=0, must-revalidate",
  };
}

/** Keep session-bearing and non-opted-in dynamic responses out of shared caches. */
export function withResponseCacheSafety(
  request: Request,
  response: Response,
  serverFunction = false,
): Response {
  if (response.status === 101) return response;
  const result = new Response(response.body, response);
  const policy = result.headers.get(PUBLIC_CACHE_POLICY_HEADER);
  const match =
    /^public,\s*max-age=(\d{1,3}),\s*stale-while-revalidate=(\d{1,3})$/i.exec(
      policy ?? "",
    );
  const validPolicy =
    match !== null &&
    Number(match[1]) > 0 &&
    Number(match[1]) <= 300 &&
    Number(match[2]) <= 300;
  const canShare =
    validPolicy &&
    !serverFunction &&
    request.method === "GET" &&
    !request.headers.has("Cookie") &&
    !request.headers.has("Authorization") &&
    !result.headers.has("Set-Cookie") &&
    result.status === 200 &&
    /^text\/html(?:;|$)/i.test(result.headers.get("Content-Type") ?? "") &&
    !/(?:^|,)\s*(?:private|no-store)(?:\s|,|=|$)/i.test(
      result.headers.get("Cache-Control") ?? "",
    );

  if (!canShare) {
    result.headers.delete(PUBLIC_CACHE_POLICY_HEADER);
    result.headers.delete("CDN-Cache-Control");
    result.headers.delete("Cloudflare-CDN-Cache-Control");
    result.headers.set("Cache-Control", "private, no-store");
  }
  return result;
}
