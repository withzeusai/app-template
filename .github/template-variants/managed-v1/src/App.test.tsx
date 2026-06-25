import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App.tsx";

vi.mock("./components/providers/default.tsx", () => ({
  DefaultProviders: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./pages/auth/Callback.tsx", () => ({
  default: () => <div>Auth callback</div>,
}));

vi.mock("./pages/auth/AccessStatus.tsx", () => ({
  AuthAccessStatus: () => <div>Access status</div>,
}));

vi.mock("./pages/Index.tsx", () => ({
  default: () => <div>App home</div>,
}));

vi.mock("./pages/NotFound.tsx", () => ({
  default: () => <div>Not found</div>,
}));

describe("managed app routes", () => {
  it.each([
    "/auth/pending-approval",
    "/auth/blocked",
    "/auth/suspended",
    "/auth/removed",
    "/auth/missing",
    "/auth/access-denied",
  ])("renders %s with the access status route", (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Access status")).toBeInTheDocument();
    expect(screen.queryByText("Not found")).not.toBeInTheDocument();
  });
});
