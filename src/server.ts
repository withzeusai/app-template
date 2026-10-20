import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withErrorPage } from "@/lib/start-error-page.ts";

/**
 * Server entry. Wraps TanStack Start's handler so an error thrown outside the
 * router shows an HTML error page instead of Start's raw JSON (see
 * `withErrorPage`). Keep this wrapper when adding to the entry.
 */
export default createServerEntry({
  async fetch(request, opts) {
    const response = await handler.fetch(request, opts);
    return withErrorPage(request, response);
  },
});
