import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./app-error-boundary.tsx";

function Throws(): never {
  throw new Error("query failed");
}

const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

function stubLocation() {
  const location = { ...originalLocation, reload: vi.fn(), assign: vi.fn() };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: location,
  });
  return location;
}

describe("AppErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <div>App content</div>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("App content")).toBeInTheDocument();
  });

  it("replaces a crashed tree with a recoverable screen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const location = stubLocation();

    render(
      <AppErrorBoundary>
        <Throws />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(location.reload).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Go home" }));
    expect(location.assign).toHaveBeenCalledWith("/");
  });
});
