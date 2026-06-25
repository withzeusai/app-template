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
  AuthAccessStatus: ({ state }: { state: string }) => (
    <div>Access state: {state}</div>
  ),
}));

vi.mock("./pages/Index.tsx", () => ({
  default: () => <div>App home</div>,
}));

vi.mock("./pages/NotFound.tsx", () => ({
  default: () => <div>Not found</div>,
}));

describe("managed app routes", () => {
  it.each([
    ["/auth/pending-approval", "pending_approval"],
    ["/auth/blocked", "blocked"],
    ["/auth/suspended", "suspended"],
    ["/auth/removed", "removed"],
    ["/auth/missing", "missing"],
    ["/auth/access-denied", "access_denied"],
  ])("renders %s as the %s access state", (path, state) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(`Access state: ${state}`)).toBeInTheDocument();
    expect(screen.queryByText("Not found")).not.toBeInTheDocument();
  });
});
