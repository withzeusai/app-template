import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImpersonationBanner } from "./impersonation-banner.tsx";

const signOut = vi.fn();

let authState: {
  impersonator: { email: string; reason: string | null } | undefined;
  signOut: typeof signOut;
} = {
  impersonator: undefined,
  signOut,
};

vi.mock("@usehercules/auth-tanstack/client", () => ({
  useAuth: () => authState,
}));

describe("ImpersonationBanner", () => {
  beforeEach(() => {
    signOut.mockReset();
    authState = { impersonator: undefined, signOut };
  });

  it("renders nothing outside an impersonation session", () => {
    const view = render(<ImpersonationBanner />);

    expect(view.container.firstChild).toBeNull();
  });

  it("shows a fixed pill and ends impersonation by signing out", () => {
    authState = {
      impersonator: { email: "admin@example.com", reason: null },
      signOut,
    };

    render(<ImpersonationBanner />);

    const controls = screen.getByRole("region", {
      name: "Impersonation controls",
    });
    expect(controls.className).toContain("fixed");
    expect(controls.className).not.toContain("sticky");
    expect(screen.getByRole("status").textContent).toBe(
      "Viewing as another user",
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
