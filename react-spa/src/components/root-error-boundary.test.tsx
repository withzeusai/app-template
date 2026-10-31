import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RootErrorBoundary } from "./root-error-boundary.tsx";

const page = { shouldThrow: true };

function FlakyPage(): React.JSX.Element {
  if (page.shouldThrow) {
    throw new Error("Query failed");
  }
  return <div>Page loaded</div>;
}

function App(): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Link to="/other">Other page</Link>
      <RootErrorBoundary>
        <Routes>
          <Route path="/" element={<FlakyPage />} />
          <Route path="/other" element={<div>Other page loaded</div>} />
        </Routes>
      </RootErrorBoundary>
    </MemoryRouter>
  );
}

beforeEach(() => {
  page.shouldThrow = true;
  // React and the boundary both report the caught error.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("RootErrorBoundary", () => {
  it("renders the page when nothing throws", () => {
    page.shouldThrow = false;
    render(<App />);

    expect(screen.getByText("Page loaded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error instead of a blank app and logs it", () => {
    render(<App />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Query failed")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      "[Runtime Error]",
      expect.objectContaining({ message: "Query failed" }),
    );
  });

  it("renders the page again after Try again", async () => {
    const user = userEvent.setup();
    render(<App />);

    page.shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Page loaded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the error when navigating to another page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Other page" }));

    expect(screen.getByText("Other page loaded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
