import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DefaultProviders } from "./default.tsx";

vi.mock("./auth.tsx", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./convex.tsx", () => ({
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./query-client.tsx", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("./theme.tsx", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../ui/tooltip.tsx", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../ui/sonner.tsx", () => ({
  Toaster: () => null,
}));

vi.mock("./impersonation-banner.tsx", () => ({
  ImpersonationBanner: () => <button type="button">Stop impersonating</button>,
}));

describe("DefaultProviders", () => {
  it("renders global controls alongside routed content", () => {
    render(
      <DefaultProviders>
        <div>Routed content</div>
      </DefaultProviders>,
    );

    expect(
      screen.getByRole("button", { name: "Stop impersonating" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Routed content")).toBeInTheDocument();
  });
});
