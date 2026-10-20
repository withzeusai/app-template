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

function isStartUnhandledError(body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "unhandled" in parsed &&
      parsed.unhandled === true &&
      "message" in parsed &&
      parsed.message === "HTTPError"
    );
  } catch {
    return false;
  }
}

/**
 * The error page. It retries once by itself, since the first request after
 * the dev server reloads can fail and the next one succeed. The stored time
 * keeps a page that keeps failing from reloading in a loop. The console line
 * uses the prefix the Hercules preview picks up, so the agent sees it.
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
      console.error("[Runtime Error] The server failed while loading " + location.pathname + ". The cause is in the server log.");
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

/** Return `response`, or the error page if it is Start's unhandled-error JSON for a page load. */
export async function withErrorPage(request: Request, response: Response): Promise<Response> {
  if (response.status < 500 || !isPageLoad(request)) return response;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }
  if (Number(response.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return response;
  }

  const body = await response.clone().text();
  if (body.length > MAX_BODY_BYTES || !isStartUnhandledError(body)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(ERROR_PAGE_HTML, { status: response.status, headers });
}
