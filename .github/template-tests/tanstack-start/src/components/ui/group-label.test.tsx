import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Each label wraps a Base UI GroupLabel, which throws when it is not inside a
// group. Apps put labels straight inside the popup, as Radix and the shadcn
// docs allow, so the open popup must render either way.
type Case = {
  name: string;
  open: (children: ReactNode) => ReactNode;
  group: (children: ReactNode) => ReactNode;
  label: ReactNode;
  item: ReactNode;
};

const cases: Case[] = [
  {
    name: "DropdownMenuLabel",
    open: (children) => (
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>{children}</DropdownMenuContent>
      </DropdownMenu>
    ),
    group: (children) => <DropdownMenuGroup>{children}</DropdownMenuGroup>,
    label: <DropdownMenuLabel>Account</DropdownMenuLabel>,
    item: <DropdownMenuItem>Profile</DropdownMenuItem>,
  },
  {
    name: "ContextMenuLabel",
    open: (children) => (
      <ContextMenu open>
        <ContextMenuTrigger>Area</ContextMenuTrigger>
        <ContextMenuContent>{children}</ContextMenuContent>
      </ContextMenu>
    ),
    group: (children) => <ContextMenuGroup>{children}</ContextMenuGroup>,
    label: <ContextMenuLabel>Account</ContextMenuLabel>,
    item: <ContextMenuItem>Profile</ContextMenuItem>,
  },
  {
    name: "SelectLabel",
    open: (children) => (
      <Select open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    ),
    group: (children) => <SelectGroup>{children}</SelectGroup>,
    label: <SelectLabel>Account</SelectLabel>,
    item: <SelectItem value="profile">Profile</SelectItem>,
  },
  {
    name: "ComboboxLabel",
    open: (children) => (
      <Combobox open>
        <ComboboxInput />
        <ComboboxContent>
          <ComboboxList>{children}</ComboboxList>
        </ComboboxContent>
      </Combobox>
    ),
    group: (children) => <ComboboxGroup>{children}</ComboboxGroup>,
    label: <ComboboxLabel>Account</ComboboxLabel>,
    item: <ComboboxItem value="profile">Profile</ComboboxItem>,
  },
];

function expectToLabelItsGroup(label: HTMLElement) {
  expect(label.id).not.toBe("");
  expect(label.closest('[role="group"]')?.getAttribute("aria-labelledby")).toBe(
    label.id,
  );
}

afterEach(cleanup);

describe.each(cases)("$name", ({ open, group, label, item }) => {
  it("renders outside a group", () => {
    render(
      open(
        <>
          {label}
          {item}
        </>,
      ),
    );

    const element = screen.getByText("Account");
    expect(element.getAttribute("aria-hidden")).toBeNull();
  });

  it("still labels the group it is in", () => {
    render(
      open(
        group(
          <>
            {label}
            {item}
          </>,
        ),
      ),
    );

    expectToLabelItsGroup(screen.getByText("Account"));
  });
});

it("DropdownMenuLabel still labels the radio group it is in", () => {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>,
  );

  expectToLabelItsGroup(screen.getByText("Account"));
});
