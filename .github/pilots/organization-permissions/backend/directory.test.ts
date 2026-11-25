import { olympusTest } from "@usehercules/olympus/test";
import { expect, it } from "vitest";
import { api } from "./.olympus/api";

it("uses the provisioned user and leaves organization creation to workspace settings", async () => {
  const backend = await olympusTest({
    env: {
      HERCULES_OIDC_AUTHORITY: "https://olympus.test",
      HERCULES_OIDC_CLIENT_ID: "app",
      HERCULES_API_KEY: "test",
    },
  });
  const person = { subject: "ada" };
  const { id } = await backend.putUser(person);
  const ada = backend.as(person);
  expect(await ada.query(api.directory.viewer)).toEqual({ id });
  expect(await ada.query(api.directory.organizations, {})).toEqual({
    items: [],
    cursor: null,
  });
  await expect(
    ada.mutation(api.directory.edit, {
      edit: {
        requestId: "create",
        expectedRevision: 0,
        command: { kind: "createOrganization", name: "App-created" },
      },
    }),
  ).rejects.toThrow();
  await expect(ada.mutation(api.reports.run)).rejects.toThrow();
});
