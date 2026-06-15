import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImpersonationBanner } from "./impersonation-banner.tsx";

const stopImpersonating = vi.fn();

let impersonationState = {
  isImpersonating: false,
  stopImpersonating,
};

vi.mock("@usehercules/auth/react", () => ({
  useHerculesImpersonation: () => impersonationState,
}));

describe("ImpersonationBanner", () => {
  afterEach(cleanup);

  beforeEach(() => {
    stopImpersonating.mockReset();
    impersonationState = {
      isImpersonating: false,
      stopImpersonating,
    };
  });

  it("renders nothing outside an impersonation session", () => {
    const view = render(<ImpersonationBanner />);

    expect(view.container.firstChild).toBeNull();
  });

  it("shows a fixed pill without shifting app layout", () => {
    impersonationState = {
      isImpersonating: true,
      stopImpersonating,
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
    expect(stopImpersonating).toHaveBeenCalledTimes(1);
  });
});
