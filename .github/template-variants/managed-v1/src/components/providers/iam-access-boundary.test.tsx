import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { IamAccessBoundary } from "./iam-access-boundary.tsx";

const { classifyIamError } = vi.hoisted(() => ({
  classifyIamError: vi.fn(() => ({
    kind: "admission" as const,
    reasonCode: "principal_blocked",
    status: "blocked" as const,
    sourceVersion: 1,
  })),
}));

vi.mock("@usehercules/auth/react", () => ({
  useAuth: () => ({ signout: vi.fn() }),
}));

vi.mock("@usehercules/convex", () => ({
  classifyIamError,
}));

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useQuery: () => ({
    kind: "principal",
    status: "blocked",
    stateVersion: 1,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/convex/_generated/api.js", () => ({
  api: {
    iam: {
      evaluateAccess: "iam:evaluateAccess",
      getTenantAccessStatus: "iam:getTenantAccessStatus",
    },
  },
}));

function AdmissionDenied(): never {
  throw new Error("admission denied");
}

describe("IamAccessBoundary", () => {
  it("redirects admission errors to their dedicated status route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <IamAccessBoundary>
                <AdmissionDenied />
              </IamAccessBoundary>
            }
          />
          <Route
            path="/auth/blocked"
            element={<div>Blocked access route</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Blocked access route")).toBeInTheDocument();
    expect(
      screen.queryByText("Your access is blocked"),
    ).not.toBeInTheDocument();
  });
});
