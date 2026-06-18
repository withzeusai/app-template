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

vi.mock("./deployment-entry.tsx", () => ({
  DeploymentEntryProvider: () => <div>Entry denied</div>,
}));

vi.mock("./impersonation-banner.tsx", () => ({
  ImpersonationBanner: () => <button type="button">Stop impersonating</button>,
}));

describe("DefaultProviders", () => {
  it("keeps impersonation controls available when deployment entry is denied", () => {
    render(
      <DefaultProviders>
        <div>Protected content</div>
      </DefaultProviders>,
    );

    expect(screen.getByText("Entry denied")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop impersonating" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
