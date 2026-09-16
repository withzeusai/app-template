import { act } from "react";
import { render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { ChartStyle, type ChartConfig } from "./chart";
import { encodeChartStyleText } from "./chart-style-text";

test.each([
  "#123abc",
  "rebeccapurple",
  "rgb(20 40 60 / 50%)",
  "hsl(240 50% 30%)",
  "oklch(0.646 0.222 41.116)",
  "color(display-p3 0.1 0.2 0.3)",
  "color-mix(in oklch, var(--chart-1) 30%, transparent)",
  "var(--chart-1, rgb(calc(20 + 5) 40 60))",
])("preserves normal stylesheet bytes for %s", (color) => {
  const config = { visitors: { color } };
  const css = `\n [data-chart=normal] {\n  --color-visitors: ${color};\n}\n\n\n.dark [data-chart=normal] {\n  --color-visitors: ${color};\n}\n`;
  expect(renderToString(<ChartStyle id="normal" config={config} />)).toBe(
    `<style>${css}</style>`,
  );
  const { container } = render(<ChartStyle id="normal" config={config} />);
  expect(container.querySelector("style")?.textContent).toBe(css);
});

test("retains distinct light/dark values and omits an empty config", () => {
  const { container } = render(
    <ChartStyle
      id="themed"
      config={{ visits: { theme: { light: "#fff", dark: "var(--chart-2)" } } }}
    />,
  );
  expect(container.querySelector("style")?.textContent).toBe(
    "\n [data-chart=themed] {\n  --color-visits: #fff;\n}\n\n\n.dark [data-chart=themed] {\n  --color-visits: var(--chart-2);\n}\n",
  );
  expect(renderToString(<ChartStyle id="empty" config={{}} />)).toBe("");
});

test.each([0, 1, 2, 3])(
  "preserves a quoted CSS token with %i preceding backslashes",
  (count) => {
    const source = `prefix${"\\".repeat(count)}<f suffix`;
    const element = document.createElement("div");
    element.setAttribute(
      "data-value",
      `prefix${"\\".repeat(Math.floor(count / 2))}<f suffix`,
    );
    const container = document.createElement("div");
    container.append(element);
    const selector = `[data-value="${source}"]`;
    expect(container.querySelector(selector)).toBe(element);
    expect(container.querySelector(encodeChartStyleText(selector))).toBe(
      element,
    );
    expect(encodeChartStyleText(selector)).not.toContain("<");
  },
);

test.each([1, 3])(
  "preserves a CSS identifier with %i preceding backslashes",
  (count) => {
    const source = `token${"\\".repeat(count)}<face`;
    const element = document.createElement("div");
    element.setAttribute(
      "data-value",
      `token${"\\".repeat(Math.floor(count / 2))}<face`,
    );
    const container = document.createElement("div");
    container.append(element);
    expect(container.querySelector(`[data-value=${source}]`)).toBe(element);
    expect(
      container.querySelector(encodeChartStyleText(`[data-value=${source}]`)),
    ).toBe(element);
  },
);

test.each([0, 2])(
  "does not claim raw less-than is a valid identifier after %i backslashes",
  (count) => {
    expect(() =>
      document.querySelector(`#token${"\\".repeat(count)}<face`),
    ).toThrow();
    expect(
      encodeChartStyleText(`token${"\\".repeat(count)}<face`),
    ).not.toContain("<");
  },
);

test("retains existing hex escapes and whitespace after encoded characters", () => {
  const source = String.raw`a\3c b "\< face" "\\<f"`;
  expect(encodeChartStyleText(source)).toBe(
    String.raw`a\3c b "\3c  face" "\\\3c f"`,
  );
});

const closingText =
  '/*</StYlE><div data-chart-injected="yes">outside</div><style>*/';
test.each(["id", "key", "color", "theme"] as const)(
  "contains closing style text supplied through %s in server and client output",
  (field) => {
    const id = field === "id" ? `safe${closingText}` : "safe";
    const config: ChartConfig = {
      [field === "key" ? `visits${closingText}` : "visits"]:
        field === "theme"
          ? { theme: { light: `#fff${closingText}`, dark: "#fff" } }
          : { color: field === "color" ? `#fff${closingText}` : "#fff" },
    };
    const markup = renderToString(<ChartStyle id={id} config={config} />);
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    expect(parsed.querySelectorAll("style")).toHaveLength(1);
    expect(parsed.querySelector("[data-chart-injected]")).toBeNull();
    expect(parsed.querySelector("style")?.textContent).not.toContain("<");
    const { container } = render(<ChartStyle id={id} config={config} />);
    expect(container.querySelector("style")?.textContent).toBe(
      parsed.querySelector("style")?.textContent,
    );
  },
);

test("server output hydrates without recoverable errors or changing style text", async () => {
  const config = {
    [String.raw`value\<part`]: { color: "var(--chart-1, #fff)" },
  };
  const component = <ChartStyle id={String.raw`chart\<part`} config={config} />;
  const container = document.createElement("div");
  container.innerHTML = renderToString(component);
  document.body.append(container);
  const before = container.innerHTML;
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, component, {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    expect(errors).toEqual([]);
    expect(container.innerHTML).toBe(before);
  } finally {
    await act(async () => root?.unmount());
    container.remove();
  }
});

test("does not claim to sanitize arbitrary CSS declarations", () => {
  const css = "[data-chart=demo] { --color-value: red; background: blue; }";
  expect(encodeChartStyleText(css)).toBe(css);
});
