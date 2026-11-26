// Run the generated app with local, signed app-user and workspace-settings tokens.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkPilotSplit } from "./check-pilot-split.mjs";

const { values } = parseArgs({
  options: { app: { type: "string" }, server: { type: "string" } },
});
if (!values.app || !values.server)
  throw new Error(
    "Pass --app <generated app> and --server <compatible olympus-server binary>.",
  );
const app = path.resolve(values.app);
const serverBinary = path.resolve(values.server);
const requireApp = createRequire(path.join(app, "package.json"));
const { olympusTest } = await import(
  pathToFileURL(requireApp.resolve("@usehercules/olympus/test"))
);
const build = await import(
  pathToFileURL(requireApp.resolve("@usehercules/olympus/build"))
);
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "pilot",
  alg: "EdDSA",
  use: "sig",
};
const issuer = createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/.well-known/openid-configuration")
    res.end(JSON.stringify({ jwks_uri: origin + "/keys" }));
  else if (req.url === "/keys") res.end(JSON.stringify({ keys: [jwk] }));
  else {
    res.statusCode = 404;
    res.end();
  }
});
async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return "http://127.0.0.1:" + server.address().port;
}
const origin = await listen(issuer);
function token(subject, audience) {
  const json = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const message =
    json({ alg: "EdDSA", kid: "pilot" }) +
    "." +
    json({
      iss: origin,
      sub: subject,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 300,
    });
  return (
    message +
    "." +
    sign(null, Buffer.from(message), privateKey).toString("base64url")
  );
}
const probe = createServer();
const url = await listen(probe);
await new Promise((resolve) => probe.close(resolve));
const temp = await mkdtemp(path.join(tmpdir(), "olympus-pilot-"));
const base = "https://pilot-cell.test";
const service = spawn(
  serverBinary,
  [
    "--dev",
    "--addr",
    new URL(url).host,
    "--files",
    path.join(temp, "files"),
    "--settings-workloads",
    JSON.stringify([
      { issuer: origin, audience: base, subjects: ["settings"] },
    ]),
  ],
  {
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      OLYMPUS_STORE:
        process.env.OLYMPUS_PILOT_POSTGRES_URL ??
        "sqlite:" + path.join(temp, "pilot.sqlite"),
    },
  },
);
let startError;
service.once("error", (e) => {
  startError = e;
});
const stopped = new Promise((resolve) => service.once("close", resolve));
try {
  let ready = false;
  for (
    let attempt = 0;
    attempt < 100 && service.exitCode === null && !startError;
    attempt++
  ) {
    try {
      ready = (
        await fetch(url + "/api/health", { signal: AbortSignal.timeout(500) })
      ).ok;
    } catch {}
    if (ready) break;
    await delay(100);
  }
  if (startError) throw startError;
  assert.ok(ready, "development server must answer before deploying");
  process.env.OLYMPUS_TEST_URL = url;
  const backend = await olympusTest({
    dir: path.join(app, "backend"),
    env: {
      HERCULES_OIDC_AUTHORITY: origin,
      HERCULES_OIDC_CLIENT_ID: "app",
      HERCULES_API_KEY: "test",
    },
  });
  const endpoint = url + "/api/db/" + backend.db;
  async function request(route, bearer, body) {
    const response = await fetch(endpoint + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: "Bearer " + bearer,
        "content-type": "application/json",
      },
      body,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(response.status + " " + JSON.stringify(result));
    return result;
  }
  function settings(operation, route, payload) {
    const body = payload && JSON.stringify(payload);
    const hash = createHash("sha256")
      .update([operation, backend.db, body ?? ""].join("\0"))
      .digest("hex");
    return request(
      "/iam/settings" + route,
      token("settings", base + "/settings/" + hash),
      body,
    );
  }
  const { databaseId } = await settings("database", "/database");
  function settingsEdit(command, expectedRevision = 0) {
    return settings("edit", "", {
      databaseId,
      human: "workspace-owner",
      reason: "internal app acceptance",
      edit: { requestId: randomUUID(), expectedRevision, command },
    });
  }
  const appCall = async (subject, kind, fn, args = {}, organization) =>
    (
      await request(
        "/" + kind,
        token(subject, "app"),
        JSON.stringify({ path: fn, args, organization }),
      )
    ).value;
  const edit = (org, expectedRevision, command, subject = "alice") =>
    appCall(
      subject,
      "mutation",
      "directory:edit",
      {
        edit: {
          requestId: randomUUID(),
          expectedRevision,
          command: { ...command, org },
        },
      },
      org,
    );
  const read = (subject, fn, org, args = {}) =>
    appCall(subject, "query", fn, args, org);
  const alice = { subject: "alice", issuer: origin },
    bob = { subject: "bob", issuer: origin };
  const { id: owner } = await backend.putUser(alice);
  const { id: user } = await backend.putUser(bob);
  assert.deepEqual(await read("alice", "directory:viewer"), { id: owner });
  const { org } = await settingsEdit({
    kind: "createOrganization",
    name: "Acme",
    owner,
  });
  const { org: other } = await settingsEdit({
    kind: "createOrganization",
    name: "Beacon",
    owner: user,
  });
  const { target: group } = await edit(org, 0, {
    kind: "createGroup",
    name: "Analysts",
    owner,
  });
  const recipient = { kind: "user", id: user },
    analysts = { kind: "group", id: group };
  await edit(org, 0, {
    kind: "grant",
    recipient: analysts,
    permission: "reports.read",
  });
  await edit(org, 0, { kind: "addMember", group, user });
  const inherited = await read("bob", "directory:sources", org, { org });
  assert.equal(inherited.items[0].canViewGroup, false);
  await assert.rejects(
    read("bob", "directory:group", org, { org, group }),
    /403/,
  );
  const details = await read("alice", "directory:group", org, { org, group });
  assert.equal(details.items[0].owner, owner);
  assert.deepEqual(await read("bob", "reports:access", org), {
    view: true,
    run: false,
  });
  assert.deepEqual(await read("bob", "reports:access", other), {
    view: true,
    run: true,
  });
  await assert.rejects(
    appCall("bob", "mutation", "reports:run", {}, org),
    /403/,
  );
  await appCall("bob", "mutation", "reports:run", {}, other);
  assert.equal((await read("bob", "reports:recent", other)).length, 1);
  assert.equal((await read("bob", "reports:recent", org)).length, 0);
  const direct = { org, recipient, permission: "reports.read" };
  const existing = await read("alice", "directory:preview", org, direct);
  assert.equal(existing.assigned, false);
  await edit(org, existing.revision, {
    kind: "grant",
    recipient,
    permission: direct.permission,
  });
  assert.deepEqual(
    (await read("bob", "directory:sources", org, { org })).items
      .map((i) => i.kind)
      .sort(),
    ["group", "user"],
  );
  await backend.putUser({ ...bob, status: "suspended" });
  await assert.rejects(read("bob", "reports:recent", org), /403/);
  await edit(org, 1, { kind: "revoke", recipient, permission: "reports.read" });
  await backend.putUser({ ...bob, status: "active" });
  assert.deepEqual(
    (await read("bob", "directory:sources", org, { org })).items.map(
      (i) => i.kind,
    ),
    ["group"],
  );
  await edit(org, 1, { kind: "removeMember", group, user });
  assert.deepEqual(await read("bob", "reports:access", org), {
    view: false,
    run: false,
  });
  await assert.rejects(read("bob", "reports:recent", org), /403/);
  assert.deepEqual(
    (await read("bob", "directory:organizations")).items.map((i) => i._id),
    [other],
  );
  await edit(org, 1, { kind: "disableOrganization" });
  await settingsEdit({ kind: "recoverOwner", org, user }, 2);
  await settingsEdit({ kind: "reactivateOrganization", org }, 2);
  assert.deepEqual(await read("bob", "reports:access", org), {
    view: true,
    run: true,
  });
  await checkPilotSplit({
    app,
    temp,
    backend,
    build,
    issuer: origin,
    edit,
    read,
    acme: org,
    beacon: other,
    group,
  });
  console.log(
    "Generated app passed authenticated two-organization, revocation, reactivation, settings recovery and permission split checks.",
  );
} finally {
  if (service.exitCode === null) service.kill("SIGTERM");
  try {
    await stopped;
  } finally {
    await new Promise((resolve) => issuer.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
}
