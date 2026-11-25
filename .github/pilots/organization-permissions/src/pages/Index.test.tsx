import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { getFunctionPath, type FunctionRef } from "@usehercules/olympus/client";
import Index from "./Index";

const client = vi.hoisted(() => {
  let selected: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get organization() {
      return selected;
    },
    setOrganization(org: string | null) {
      if (selected === org) return;
      selected = org;
      for (const changed of listeners) changed();
    },
    onOrganizationChange(changed: () => void) {
      listeners.add(changed);
      return () => listeners.delete(changed);
    },
  };
});

vi.mock("@/components/ui/signin", () => ({ SignInButton: () => null }));
vi.mock("@usehercules/olympus/react", () => ({
  useOlympus: () => client,
  useOlympusAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => vi.fn(),
  useQuery: (ref: FunctionRef, args?: { cursor: string | null }) => {
    switch (getFunctionPath(ref)) {
      case "directory:organizations":
        return args?.cursor
          ? { items: [{ _id: "beacon", name: "Beacon" }], cursor: null }
          : { items: [], cursor: "more" };
      case "reports:access":
        return { view: true, run: false };
      case "reports:recent":
        return [];
      case "directory:sources":
        return {
          items: [
            {
              kind: "group",
              name: "Analysts",
              id: "group",
              permissions: ["reports.read"],
            },
          ],
          cursor: null,
        };
      default:
        throw new Error("Unexpected query " + String(ref));
    }
  },
}));

it("can select an organization after an empty directory page and clears its access on switch", async () => {
  const user = userEvent.setup();
  render(<Index />);
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Beacon" }));
  expect(client.organization).toBe("beacon");
  expect(screen.getByRole("heading", { name: "Beacon" })).toBeInTheDocument();
  expect(screen.getByText(/Analysts: reports.read/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Switch organization" }));
  expect(client.organization).toBeNull();
  expect(screen.queryByText(/Analysts/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
});
