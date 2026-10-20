/**
 * TanStack Start answers an error thrown outside the router (request
 * middleware, a server route, a module that fails to load) with a fixed JSON
 * body and logs the real error on the server. `withErrorPage` swaps that body
 * for an HTML error page when a browser loads a page, so visitors never see
 * raw JSON. Fetches from the app keep the JSON they expect.
 */

// Start's body is about 70 bytes; anything larger is the app's own response.
const MAX_BODY_BYTES = 1024;

function isPageLoad(request: Request): boolean {
  if (request.method !== "GET") return false;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest != null) return dest === "document" || dest === "iframe";
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

// Exactly the keys Start writes; an app's own error JSON with extra detail
// passes through.
const START_ERROR_KEYS = ["message", "status", "statusText", "unhandled"];

/**
 * Read at most `limit` bytes of a copy of `response`'s body, or null if it is
 * longer. Stops early, so a large or never-ending body is not buffered.
 */
async function readBoundedBody(
  response: Response,
  limit: number,
): Promise<string | null> {
  const body = response.clone().body;
  if (body == null) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) return null;
      chunks.push(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isStartUnhandledError(body: string, status: number): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return false;
  }
  const keys = Object.keys(parsed).sort();
  if (keys.join() !== START_ERROR_KEYS.join()) return false;
  const fields = parsed as Record<string, unknown>;
  return (
    fields.status === status &&
    typeof fields.statusText === "string" &&
    fields.unhandled === true &&
    fields.message === "HTTPError"
  );
}

/**
 * The error page for deployed apps. It retries once by itself in case the
 * failure was momentary; the stored time keeps a page that keeps failing from
 * reloading in a loop.
 */
export const ERROR_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Something went wrong</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        text-align: center;
      }
      main { max-width: 28rem; }
      h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { margin: 0 0 1.5rem; opacity: 0.7; line-height: 1.5; }
      button {
        font: inherit;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        border: 1px solid currentColor;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Something went wrong</h1>
      <p id="message">This page ran into a problem. Try again in a moment.</p>
      <button id="retry" type="button">Try again</button>
    </main>
    <script>
      document.getElementById("retry").addEventListener("click", function () {
        location.reload();
      });
      var key = "start-error-retry:" + location.pathname + location.search;
      var last = 0;
      try { last = Number(sessionStorage.getItem(key)) || 0; } catch (e) {}
      if (Date.now() - last > 30000) {
        try {
          sessionStorage.setItem(key, String(Date.now()));
          document.getElementById("message").textContent = "Trying again…";
          document.getElementById("retry").hidden = true;
          setTimeout(function () { location.reload(); }, 1500);
        } catch (e) {}
      }
    </script>
  </body>
</html>
`;

/**
 * Return `response`, or the error page if it is Start's unhandled-error JSON
 * for a page load.
 */
export async function withErrorPage(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500 || !isPageLoad(request)) return response;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }
  if (Number(response.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return response;
  }

  const body = await readBoundedBody(response, MAX_BODY_BYTES);
  if (body == null || !isStartUnhandledError(body, response.status)) {
    return response;
  }
  await response.body?.cancel();

  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  // The app's policy may block the page's inline script and styles.
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");
  return new Response(ERROR_PAGE_HTML, { status: response.status, headers });
}
