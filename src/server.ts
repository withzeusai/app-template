import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withErrorPage } from "@/lib/start-error-page.ts";

/**
 * Server entry. In a deployed app, an error thrown outside the router shows
 * an HTML error page instead of TanStack Start's raw JSON (see
 * `withErrorPage`). In dev the JSON is left alone: the Hercules preview
 * retries it through dev server restarts and reports lasting failures to the
 * agent. Keep this wrapper when adding to the entry.
 */
export default createServerEntry({
  async fetch(request, opts) {
    const response = await handler.fetch(request, opts);
    return import.meta.env.DEV ? response : withErrorPage(request, response);
  },
});
