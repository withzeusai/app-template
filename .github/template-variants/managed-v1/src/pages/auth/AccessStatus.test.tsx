import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthAccessStatus } from "./AccessStatus.tsx";

const evaluateAccess = vi.fn();
const signout = vi.fn();

vi.mock("@usehercules/auth/react", () => ({
  useAuth: () => ({ signout }),
}));

vi.mock("convex/react", () => ({
  useAction: () => evaluateAccess,
}));

vi.mock("@/convex/_generated/api.js", () => ({
  api: {
    iam: {
      evaluateAccess: "iam:evaluateAccess",
    },
  },
}));

describe("AuthAccessStatus", () => {
  beforeEach(() => {
    evaluateAccess.mockReset();
    signout.mockReset();
  });

  it("returns home when a pending request becomes allowed", async () => {
    evaluateAccess.mockResolvedValue({
      allowed: true,
      status: "active",
    });

    render(
      <MemoryRouter initialEntries={["/auth/pending-approval"]}>
        <Routes>
          <Route
            path="/auth/pending-approval"
            element={<AuthAccessStatus state="pending_approval" />}
          />
          <Route path="/" element={<div>App home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Your access request is pending",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() => {
      expect(screen.getByText("App home")).toBeInTheDocument();
    });
    expect(evaluateAccess).toHaveBeenCalledWith({});
  });

  it("moves to the route for a changed access state", async () => {
    evaluateAccess.mockResolvedValue({
      allowed: false,
      status: "blocked",
    });

    render(
      <MemoryRouter initialEntries={["/auth/pending-approval"]}>
        <Routes>
          <Route
            path="/auth/pending-approval"
            element={<AuthAccessStatus state="pending_approval" />}
          />
          <Route
            path="/auth/blocked"
            element={<div>Blocked access route</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() => {
      expect(screen.getByText("Blocked access route")).toBeInTheDocument();
    });
  });
});
