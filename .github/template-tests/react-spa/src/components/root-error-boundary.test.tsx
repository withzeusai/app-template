import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RootErrorBoundary } from "@/components/root-error-boundary.tsx";

function Broken(): React.JSX.Element {
  throw new Error("Unauthenticated");
}

beforeEach(() => {
  // React and the boundary both report the caught error.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RootErrorBoundary", () => {
  it("renders the app when nothing throws", () => {
    render(
      <RootErrorBoundary>
        <div>App loaded</div>
      </RootErrorBoundary>,
    );

    expect(screen.getByText("App loaded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a reload screen instead of a blank page and logs the error", () => {
    render(
      <RootErrorBoundary>
        <Broken />
      </RootErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(console.error).toHaveBeenCalledWith(
      "[Runtime Error]",
      expect.objectContaining({ message: "Unauthenticated" }),
    );
  });

  it("reloads the page from the button", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(
      <RootErrorBoundary>
        <Broken />
      </RootErrorBoundary>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Reload page" }));

    expect(reload).toHaveBeenCalledOnce();
  });
});
