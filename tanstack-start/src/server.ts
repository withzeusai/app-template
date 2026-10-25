import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withErrorPage } from "@/lib/start-error-page.ts";

// Hercules adds HSTS and X-Frame-Options itself, from the app's Security settings.
const SECURITY_HEADERS = [
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
] as const;

// Deployed apps get an HTML error page instead of Start's raw JSON (dev keeps
// the JSON for the preview), and every response gets SECURITY_HEADERS.
export default createServerEntry({
  async fetch(request, opts) {
    let response = await handler.fetch(request, opts);
    if (!import.meta.env.DEV) response = await withErrorPage(request, response);
    const missing = SECURITY_HEADERS.filter(
      ([name]) => !response.headers.has(name),
    );
    if (missing.length === 0 || response.status < 200) return response;
    // Copy first: some responses have immutable headers.
    const secured = new Response(response.body, response);
    for (const [name, value] of missing) secured.headers.set(name, value);
    return secured;
  },
});
