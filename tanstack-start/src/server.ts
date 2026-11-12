import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withErrorPage } from "@/lib/start-error-page.ts";

// Deployed apps get an HTML error page instead of Start's raw JSON (dev keeps
// the JSON for the preview).
//
// No security headers are set here. Hercules adds X-Content-Type-Options and
// Referrer-Policy to every response of a published app, the static files this
// entry never sees included, so setting them here sent each one twice. HSTS
// and framing protection come from the app's Security settings.
export default createServerEntry({
  async fetch(request, opts) {
    const response = await handler.fetch(request, opts);
    if (import.meta.env.DEV) return response;
    return withErrorPage(request, response);
  },
});
