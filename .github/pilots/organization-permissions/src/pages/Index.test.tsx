import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
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

const directory = vi.hoisted(() => ({
  canViewGroup: vi.fn((org?: string) => org === "atlas"),
  group: vi.fn((args?: { org?: string; group?: string }) => {
    if (args?.org !== "atlas" || args.group !== "atlas-analysts")
      throw new Error("Group unavailable");
    return { items: [{ owner: "Ada" }], cursor: null };
  }),
}));

beforeEach(() => {
  directory.canViewGroup.mockReset();
  directory.group.mockClear();
});

vi.mock("@/components/ui/signin", () => ({ SignInButton: () => null }));
vi.mock("@usehercules/olympus/react", () => ({
  useOlympus: () => client,
  useOlympusAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => vi.fn(),
  useQuery: (
    ref: FunctionRef,
    args?: { cursor?: string | null; org?: string; group?: string },
  ) => {
    switch (getFunctionPath(ref)) {
      case "directory:organizations":
        return args?.cursor
          ? {
              items: [
                { _id: "beacon", name: "Beacon" },
                { _id: "atlas", name: "Atlas" },
              ],
              cursor: null,
            }
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
              id: args?.org + "-analysts",
              permissions: ["reports.read"],
              canViewGroup: directory.canViewGroup(args?.org),
            },
          ],
          cursor: null,
        };
      case "directory:group":
        return directory.group(args);
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
  expect(
    screen.queryByRole("button", { name: "View group owner" }),
  ).not.toBeInTheDocument();
  expect(directory.group).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Switch organization" }));
  expect(client.organization).toBeNull();
  expect(screen.queryByText(/Analysts/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
});

it("reads a group's owner on demand while the source allows it", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Index />);
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Atlas" }));
  expect(directory.group).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "View group owner" }));
  expect(directory.group).toHaveBeenCalledWith({
    org: "atlas",
    group: "atlas-analysts",
  });
  expect(screen.getByText("Group owner: Ada")).toBeInTheDocument();

  directory.group.mockClear();
  directory.canViewGroup.mockReturnValue(false);
  rerender(<Index />);
  expect(screen.getByText(/Analysts: reports.read/)).toBeInTheDocument();
  expect(screen.queryByText("Group owner: Ada")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "View group owner" }),
  ).not.toBeInTheDocument();
  expect(directory.group).not.toHaveBeenCalled();
});

it("clears an open group owner when switching organizations", async () => {
  const user = userEvent.setup();
  render(<Index />);
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Atlas" }));
  await user.click(screen.getByRole("button", { name: "View group owner" }));
  expect(screen.getByText("Group owner: Ada")).toBeInTheDocument();
  directory.group.mockClear();
  await user.click(screen.getByRole("button", { name: "Switch organization" }));
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Beacon" }));
  expect(screen.getByText(/Analysts: reports.read/)).toBeInTheDocument();
  expect(screen.queryByText("Group owner: Ada")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "View group owner" }),
  ).not.toBeInTheDocument();
  expect(directory.group).not.toHaveBeenCalled();
});
