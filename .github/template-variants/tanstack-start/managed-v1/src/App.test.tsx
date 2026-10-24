import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.tsx";

vi.mock("./components/providers/default.tsx", () => ({
  DefaultProviders: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./components/providers/deployment-entry.tsx", () => ({
  DeploymentEntryProvider: () => <div>Entry denied</div>,
}));

vi.mock("./pages/auth/Callback.tsx", () => ({
  default: () => <div>Auth callback</div>,
}));

vi.mock("./pages/Index.tsx", () => ({
  default: () => <div>App home</div>,
}));

vi.mock("./pages/NotFound.tsx", () => ({
  default: () => <div>Not found</div>,
}));

describe("App routing", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("keeps the authentication callback outside deployment entry", () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback?code=test&state=test",
    );

    render(<App />);

    expect(screen.getByText("Auth callback")).toBeInTheDocument();
    expect(screen.queryByText("Entry denied")).not.toBeInTheDocument();
  });

  it("keeps app routes inside deployment entry", () => {
    render(<App />);

    expect(screen.getByText("Entry denied")).toBeInTheDocument();
    expect(screen.queryByText("App home")).not.toBeInTheDocument();
  });
});
