import { describe, expect, it } from "vitest";
import { withSecurityHeaders } from "./security-headers.ts";

describe("withSecurityHeaders", () => {
  it("adds the headers and keeps the response", async () => {
    const response = withSecurityHeaders(
      new Response("<p>hi</p>", {
        status: 404,
        headers: { "content-type": "text/html" },
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.has("strict-transport-security")).toBe(false);
    expect(response.headers.has("x-frame-options")).toBe(false);
    await expect(response.text()).resolves.toBe("<p>hi</p>");
  });

  it("keeps a value the app set itself", () => {
    const original = new Response(null, {
      headers: { "referrer-policy": "no-referrer" },
    });

    const response = withSecurityHeaders(original);

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns the same response when nothing is missing", () => {
    const original = new Response(null, {
      headers: {
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });

    expect(withSecurityHeaders(original)).toBe(original);
  });

  it("handles a redirect, whose headers are immutable", () => {
    const response = withSecurityHeaders(
      Response.redirect("https://app.example.com/", 302),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.example.com/");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
