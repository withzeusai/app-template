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

vi.mock("./deployment-entry.tsx", () => ({
  DeploymentEntryProvider: ({ children }: { children: React.ReactNode }) => (
    <>
      <div>Deployment entry initialized</div>
      {children}
    </>
  ),
}));

describe("DefaultProviders", () => {
  it("initializes deployment entry alongside routed content", () => {
    render(
      <DefaultProviders>
        <div>Routed content</div>
      </DefaultProviders>,
    );

    expect(
      screen.getByRole("button", { name: "Stop impersonating" }),
    ).not.toBeNull();
    expect(screen.getByText("Deployment entry initialized")).not.toBeNull();
    expect(screen.getByText("Routed content")).not.toBeNull();
  });
});
