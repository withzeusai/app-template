// Exercise a staged permission split against the generated app's deployed database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, rename, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const source = "reports.read";
const readRows = "reports.readRows";
const readLayout = "reports.readLayout";

export async function checkPilotSplit({
  app,
  temp,
  backend,
  build,
  issuer,
  edit,
  read,
  acme,
  beacon,
  group,
}) {
  const dir = path.join(temp, "backend");
  await cp(path.join(app, "backend"), dir, { recursive: true });
  await symlink(
    path.join(app, "node_modules"),
    path.join(temp, "node_modules"),
    "dir",
  );
  await rename(
    path.join(dir, "schema.ts"),
    path.join(dir, ".original-schema.ts"),
  );

  // Both abilities originally use reports.read. The second release introduces
  // separate keys without changing what an unconverted grant can do.
  await writeFile(
    path.join(dir, "split.ts"),
    `
import { query } from "./.olympus/server";
export const layout = query(async (ctx) => {
  const org = await ctx.auth.organization();
  if (!org) throw new Error("Choose an organization.");
  await ctx.auth.require(org, "reports.describe");
  return ["author", "couldViewReports"];
});
export const recipients = query((ctx, { org, recipientKind }: { org: string; recipientKind: "user" | "group" }) =>
  ctx.directory.read({ kind: "splitRecipients", org, source: "reports.read", recipientKind }));
export const status = query((ctx, { org }: { org: string }) =>
  ctx.directory.read({ kind: "splitStatus", org, source: "reports.read" }));
`,
  );
  async function deployCatalog(definitions, operations, splits) {
    await writeFile(
      path.join(dir, "schema.ts"),
      `
import original from "./.original-schema";
import { schema } from "@usehercules/olympus/server";
const permissions = original.options!.permissions!;
export default schema(original.tables, {
  permissions: {
    ...permissions,
    definitions: { ...permissions.definitions, ...${JSON.stringify(definitions)} },
    operations: { ...permissions.operations, ...${JSON.stringify(operations)} },
    splits: ${JSON.stringify(splits)},
  },
});
`,
    );
    const project = await build.scanProject(dir);
    await build.codegen(project);
    execFileSync(
      path.join(app, "node_modules/.bin/tsc"),
      ["--noEmit", "-p", dir],
      { stdio: "inherit" },
    );
    await build.deploy(
      backend.url,
      backend.db,
      await build.bundle(project, { mode: "development" }),
    );
  }

  await deployCatalog({}, { "reports.describe": [source] }, {});
  const { id } = await backend.putUser({ issuer, subject: "reader" });
  const recipient = { kind: "user", id };
  const grant = { kind: "grant", permission: source, recipient };
  await edit(acme, 0, grant, "alice");
  await edit(beacon, 0, grant, "bob");
  async function canReadBoth(org) {
    assert.ok(Array.isArray(await read("reader", "reports:recent", org)));
    assert.deepEqual(await read("reader", "split:layout", org), [
      "author",
      "couldViewReports",
    ]);
  }
  await canReadBoth(acme);
  await canReadBoth(beacon);
  await deployCatalog(
    { [readRows]: {}, [readLayout]: {} },
    {
      "reports.view": [source, readRows],
      "reports.describe": [source, readLayout],
    },
    { [source]: { version: 1, replacements: [readRows, readLayout] } },
  );
  await canReadBoth(acme);
  await canReadBoth(beacon);

  const decisions = [];
  for (const [kind, target, replacement] of [
    ["user", id, readRows],
    ["group", group, readLayout],
  ]) {
    const preview = await read("alice", "split:recipients", acme, {
      org: acme,
      recipientKind: kind,
    });
    assert.equal(preview.cursor, null);
    assert.equal(preview.items.length, 1);
    const row = preview.items[0];
    assert.deepEqual(row.recipient, { kind, id: target });
    assert.deepEqual(
      row.replacements.toSorted(),
      [readRows, readLayout].sort(),
    );
    decisions.push({
      recipient: row.recipient,
      revision: row.revision,
      rosterRevision: row.rosterRevision,
      replacements: [replacement],
    });
  }
  const approve = { kind: "approveSplit", source, version: 1 };
  await assert.rejects(edit(beacon, 0, approve, "alice"), /403/);
  const review = await edit(
    acme,
    0,
    { kind: "reviewSplit", source, version: 1, decisions },
    "alice",
  );
  await edit(acme, review.revision, approve, "alice");
  let status;
  for (let i = 0; i < 100; i++) {
    const page = await read("alice", "split:status", acme, { org: acme });
    status = page.items[0];
    if (status.phase === "complete") break;
    await delay(100);
  }
  assert.equal(status.phase, "complete");
  assert.equal(status.converted, 2);
  assert.equal(status.closed, true);
  assert.ok(Array.isArray(await read("reader", "reports:recent", acme)));
  await assert.rejects(read("reader", "split:layout", acme), /403/);
  await canReadBoth(beacon);
  const legacy = await read("reader", "directory:sources", beacon, {
    org: beacon,
  });
  assert.deepEqual(
    legacy.items.map((row) => row.permissions),
    [[source]],
  );

  // The group's distinct replacement still reaches this user through membership.
  const roster = await read("alice", "directory:group", acme, {
    org: acme,
    group,
  });
  await edit(
    acme,
    roster.items[0].rosterRevision,
    { kind: "addMember", group, user: id },
    "alice",
  );
  await canReadBoth(acme);
}
