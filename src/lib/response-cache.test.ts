import { describe, expect, test } from "vitest";
import {
  publicHtmlCacheHeaders,
  withResponseCacheSafety,
  PUBLIC_CACHE_POLICY_HEADER,
} from "./response-cache";

function page(headers: HeadersInit = publicHtmlCacheHeaders()) {
  const combined = new Headers(headers);
  combined.set("Content-Type", "text/html; charset=utf-8");
  return new Response("<h1>Public product</h1>", { headers: combined });
}

describe("response cache safety", () => {
  test("preserves explicit anonymous opt-in without changing SSR content", async () => {
    const response = withResponseCacheSafety(
      new Request("https://shop.example/products/a"),
      page(),
    );
    expect(response.headers.get(PUBLIC_CACHE_POLICY_HEADER)).toBe(
      "public, max-age=60, stale-while-revalidate=120",
    );
    expect(await response.text()).toBe("<h1>Public product</h1>");
  });

  test.each<Record<string, string>>([
    { Cookie: "session=alice" },
    { Authorization: "Bearer alice" },
    { Cookie: "" },
  ])("private requests cannot retain public headers: %j", (headers) => {
    const response = withResponseCacheSafety(
      new Request("https://shop.example/products/a", { headers }),
      page(),
    );
    expect(response.headers.get(PUBLIC_CACHE_POLICY_HEADER)).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("preserves Set-Cookie while removing public opt-in", () => {
    const response = withResponseCacheSafety(
      new Request("https://shop.example/"),
      page({
        ...publicHtmlCacheHeaders(),
        "Set-Cookie": "session=alice; Secure; HttpOnly",
      }),
    );
    expect(response.headers.get("Set-Cookie")).toBe(
      "session=alice; Secure; HttpOnly",
    );
    expect(response.headers.get(PUBLIC_CACHE_POLICY_HEADER)).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("server functions cannot opt into public HTML caching", () => {
    const response = withResponseCacheSafety(
      new Request("https://shop.example/_serverFn/test"),
      page(),
      true,
    );
    expect(response.headers.get(PUBLIC_CACHE_POLICY_HEADER)).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("dynamic responses are private by default and explicit no-store wins", () => {
    const request = new Request("https://shop.example/");
    expect(
      withResponseCacheSafety(request, page({})).headers.get("Cache-Control"),
    ).toBe("private, no-store");
    expect(
      withResponseCacheSafety(
        request,
        page({ ...publicHtmlCacheHeaders(), "Cache-Control": "no-store" }),
      ).headers.get(PUBLIC_CACHE_POLICY_HEADER),
    ).toBeNull();
  });

  test("rejects unsafe TTLs and malformed policies", () => {
    expect(() => publicHtmlCacheHeaders({ staleSeconds: 301 })).toThrow(
      RangeError,
    );
    expect(() => publicHtmlCacheHeaders({ freshSeconds: 0 })).toThrow(
      RangeError,
    );
    expect(() => publicHtmlCacheHeaders({ freshSeconds: 1.5 })).toThrow(
      RangeError,
    );
    const response = withResponseCacheSafety(
      new Request("https://shop.example/"),
      page({
        [PUBLIC_CACHE_POLICY_HEADER]:
          "public, max-age=999, stale-while-revalidate=120",
      }),
    );
    expect(response.headers.get(PUBLIC_CACHE_POLICY_HEADER)).toBeNull();
  });
});
