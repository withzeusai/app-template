import { describe, expect, it } from "vitest";
import { ERROR_PAGE_HTML, withErrorPage } from "./start-error-page.ts";

const START_BODY = JSON.stringify({
  status: 500,
  statusText: "",
  unhandled: true,
  message: "HTTPError",
});

function pageRequest(
  headers: Record<string, string> = { "sec-fetch-dest": "document" },
) {
  return new Request("https://app.example.com/notes/1", { headers });
}

function startError(body = START_BODY, status = 500) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("withErrorPage", () => {
  it("serves the error page for Start's error JSON", async () => {
    const response = await withErrorPage(pageRequest(), startError());

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(ERROR_PAGE_HTML);
  });

  it("detects a page load from Accept alone", async () => {
    const response = await withErrorPage(
      pageRequest({ accept: "text/html,application/xhtml+xml" }),
      startError(),
    );

    expect(await response.text()).toBe(ERROR_PAGE_HTML);
  });

  it("keeps the JSON for fetches from the app", async () => {
    const original = startError();
    const response = await withErrorPage(
      pageRequest({ "sec-fetch-dest": "empty", accept: "*/*" }),
      original,
    );

    expect(response).toBe(original);
  });

  it("keeps the app's own JSON errors", async () => {
    const original = startError(JSON.stringify({ error: "database down" }));
    const response = await withErrorPage(pageRequest(), original);

    expect(response).toBe(original);
    expect(await response.text()).toBe(
      JSON.stringify({ error: "database down" }),
    );
  });

  it("keeps responses below 500", async () => {
    const original = startError(START_BODY, 404);

    expect(await withErrorPage(pageRequest(), original)).toBe(original);
  });
});
