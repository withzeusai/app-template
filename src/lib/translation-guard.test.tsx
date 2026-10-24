import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RootErrorBoundary } from "@/components/root-error-boundary.tsx";
import { guardDomAgainstTranslation } from "./translation-guard.ts";

const { removeChild, insertBefore } = Node.prototype;

function Greeting({ greet, badge }: { greet: boolean; badge: boolean }) {
  return (
    <div data-testid="greeting">
      {badge && <span>New</span>}
      {greet && "Bonjour"}
      <button>Continue</button>
    </div>
  );
}

// Swaps React's text node for a <font> element, like Chrome's translator.
function translatePage() {
  const container = screen.getByTestId("greeting");
  const text = [...container.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE,
  )!;
  const font = document.createElement("font");
  font.textContent = "Hello";
  container.replaceChild(font, text);
}

function renderTranslated() {
  const view = render(
    <RootErrorBoundary>
      <Greeting greet badge={false} />
    </RootErrorBoundary>,
  );
  translatePage();
  return view;
}

describe("page translation", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Node.prototype.removeChild = removeChild;
    Node.prototype.insertBefore = insertBefore;
  });

  it("shows the reload prompt instead of a blank page on a crash", () => {
    const { rerender } = renderTranslated();
    rerender(
      <RootErrorBoundary>
        <Greeting greet={false} badge={false} />
      </RootErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("keeps rendering when React removes translated text", () => {
    guardDomAgainstTranslation();
    const { rerender } = renderTranslated();
    rerender(
      <RootErrorBoundary>
        <Greeting greet={false} badge={false} />
      </RootErrorBoundary>,
    );
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
  });

  it("keeps rendering when React inserts before translated text", () => {
    guardDomAgainstTranslation();
    const { rerender } = renderTranslated();
    rerender(
      <RootErrorBoundary>
        <Greeting greet badge />
      </RootErrorBoundary>,
    );
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
  });
});
