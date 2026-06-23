import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { materializeTemplateVariants } from "./materialize-template-variants.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

let outputRoot;

before(async () => {
  outputRoot = await mkdtemp(path.join(os.tmpdir(), "app-template-variants-"));
  await materializeTemplateVariants({ repositoryRoot, outputRoot });
});

after(async () => {
  await rm(outputRoot, { force: true, recursive: true });
});

test("materializes the legacy template without managed IAM", async () => {
  const legacyRoot = path.join(outputRoot, "legacy");
  const packageJson = JSON.parse(
    await readFile(path.join(legacyRoot, "package.json"), "utf8"),
  );
  const defaultProviders = await readFile(
    path.join(legacyRoot, "src/components/providers/default.tsx"),
    "utf8",
  );
  const app = await readFile(path.join(legacyRoot, "src/App.tsx"), "utf8");

  assert.equal(packageJson.dependencies["@usehercules/convex"], undefined);
  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.doesNotMatch(defaultProviders, /DeploymentEntryProvider/);
  assert.doesNotMatch(app, /DeploymentEntryProvider/);
  await assert.rejects(readFile(path.join(legacyRoot, "hercules/iam.jsonc")));
  await assert.rejects(readFile(path.join(legacyRoot, "convex/iam.ts")));
});

test("materializes the managed template with the IAM overlay", async () => {
  const managedRoot = path.join(outputRoot, "managed-v1");
  const packageJson = JSON.parse(
    await readFile(path.join(managedRoot, "package.json"), "utf8"),
  );
  const defaultProviders = await readFile(
    path.join(managedRoot, "src/components/providers/default.tsx"),
    "utf8",
  );
  const authCallback = await readFile(
    path.join(managedRoot, "src/pages/auth/Callback.tsx"),
    "utf8",
  );
  const app = await readFile(path.join(managedRoot, "src/App.tsx"), "utf8");
  const users = await readFile(
    path.join(managedRoot, "convex/users.ts"),
    "utf8",
  );
  const iam = await readFile(path.join(managedRoot, "convex/iam.ts"), "utf8");
  const generatedApi = await readFile(
    path.join(managedRoot, "convex/_generated/api.d.ts"),
    "utf8",
  );

  assert.ok(packageJson.dependencies["@usehercules/convex"]);
  assert.match(packageJson.scripts.build, /hercules-convex-iam-check/);
  assert.doesNotMatch(defaultProviders, /DeploymentEntryProvider/);
  assert.match(authCallback, /api\.iam\.enterDeployment/);
  assert.match(authCallback, /Promise\.all/);
  assert.doesNotMatch(app, /DeploymentEntryProvider/);
  assert.match(app, /path="\/auth\/callback"/);
  assert.match(users, /authenticatedMutation/);
  assert.match(users, /from "\.\/iam"/);
  assert.match(iam, /createIam/);
  assert.match(iam, /createDeploymentEntryAction/);
  assert.doesNotMatch(iam, /^\s*["']use node["'];?/m);
  assert.match(generatedApi, /iam: typeof iam/);
  assert.doesNotMatch(
    generatedApi,
    /accessAdmin|accessOrg|accessOrgAdmin|accessUser|access: typeof access|hercules: typeof hercules/,
  );
  await readFile(path.join(managedRoot, "hercules/iam.jsonc"));
  for (const file of [
    "access.ts",
    "accessAdmin.ts",
    "accessManagement.ts",
    "iamManagement.ts",
    "accessOrg.ts",
    "accessOrgAdmin.ts",
    "accessService.ts",
    "iamService.ts",
    "accessUser.ts",
    "hercules.ts",
  ]) {
    await assert.rejects(readFile(path.join(managedRoot, "convex", file)));
  }
  await assert.rejects(
    readFile(
      path.join(managedRoot, "src/components/providers/deployment-entry.tsx"),
    ),
  );
});

test("keeps repository and build-only files out of both templates", async () => {
  for (const variant of ["legacy", "managed-v1"]) {
    const variantRoot = path.join(outputRoot, variant);

    await assert.rejects(readFile(path.join(variantRoot, ".github")));
    await assert.rejects(readFile(path.join(variantRoot, ".git")));
    await assert.rejects(readFile(path.join(variantRoot, "node_modules")));
    await assert.rejects(readFile(path.join(variantRoot, "dist")));
  }
});

test("allows required dependency builds in both variants", async () => {
  for (const variant of ["legacy", "managed-v1"]) {
    const workspace = await readFile(
      path.join(outputRoot, variant, "pnpm-workspace.yaml"),
      "utf8",
    );

    assert.match(workspace, /"@swc\/core": true/);
    assert.match(workspace, /esbuild: true/);
  }
});

test("rejects an output directory that overlaps the repository", async () => {
  const nestedOutput = path.join(repositoryRoot, ".template-output-test");

  try {
    await assert.rejects(
      materializeTemplateVariants({
        repositoryRoot,
        outputRoot: nestedOutput,
      }),
      /must not overlap/,
    );
  } finally {
    await rm(nestedOutput, { force: true, recursive: true });
  }
});
