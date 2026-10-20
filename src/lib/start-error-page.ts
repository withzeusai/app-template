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

// How long reading the body may take before the response is passed through
// untouched. Start writes its body in one piece.
const BODY_TIMEOUT_MS = 1000;

function byobReader(
  stream: ReadableStream<Uint8Array>,
): ReadableStreamBYOBReader | null {
  try {
    return stream.getReader({ mode: "byob" });
  } catch {
    // Not a byte stream.
    return null;
  }
}

/**
 * Read up to `limit` bytes of `stream`, or null if it is longer or takes
 * longer than `timeoutMs`. A byte stream is read into a buffer of `limit + 1`
 * bytes, so no read pulls more than that; any other stream is read chunk by
 * chunk and dropped once it passes the limit.
 */
async function readPrefix(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  timeoutMs: number,
): Promise<Uint8Array | null> {
  const byob = byobReader(stream);
  const plain = byob == null ? stream.getReader() : null;
  const reader = byob ?? plain;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    reader?.cancel().catch(() => {});
  }, timeoutMs);

  let buffer = new Uint8Array(limit + 1);
  let size = 0;

  async function readOnce(): Promise<boolean> {
    if (byob) {
      const view = new Uint8Array(
        buffer.buffer,
        size,
        buffer.byteLength - size,
      );
      const { done, value } = await byob.read(view);
      if (value) {
        buffer = new Uint8Array(value.buffer, 0, limit + 1);
        size += value.byteLength;
      }
      return done;
    }
    if (plain == null) return true;
    const { done, value } = await plain.read();
    if (value) {
      const room = Math.max(0, buffer.byteLength - size);
      buffer.set(value.subarray(0, room), size);
      size += value.byteLength;
    }
    return done;
  }

  try {
    let done = false;
    while (!done && !timedOut && size <= limit) {
      done = await readOnce();
    }
  } finally {
    clearTimeout(timer);
    reader?.cancel().catch(() => {});
  }
  if (timedOut || size > limit) return null;
  return buffer.subarray(0, size);
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
  { bodyTimeoutMs = BODY_TIMEOUT_MS }: { bodyTimeoutMs?: number } = {},
): Promise<Response> {
  if (response.status < 500 || !isPageLoad(request)) return response;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }
  if (Number(response.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return response;
  }

  const stream = response.clone().body;
  if (stream == null) return response;
  const prefix = await readPrefix(stream, MAX_BODY_BYTES, bodyTimeoutMs);
  if (prefix == null) return response;
  const body = new TextDecoder().decode(prefix);
  if (!isStartUnhandledError(body, response.status)) return response;
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
