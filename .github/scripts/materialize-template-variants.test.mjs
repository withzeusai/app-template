import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  materializeTemplateVariants,
  templates,
} from "./materialize-template-variants.mjs";

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

function variantRoots() {
  return Object.entries(templates).flatMap(([template, variants]) =>
    variants.map((variant) => path.join(outputRoot, template, variant)),
  );
}

test("lists every template directory in the repository", async () => {
  const { stdout } = await promisify(execFile)("git", ["ls-files"], {
    cwd: repositoryRoot,
  });
  const templateDirectories = stdout
    .split("\n")
    .filter((file) => /^[^/.][^/]*\/package\.json$/.test(file))
    .map((file) => file.split("/")[0])
    .sort();

  assert.deepEqual(templateDirectories, Object.keys(templates).sort());
});

test("materializes the react-spa template without managed access control", async () => {
  const legacyRoot = path.join(outputRoot, "react-spa/legacy");
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
  await assert.rejects(readFile(path.join(legacyRoot, "convex/accessUser.ts")));
});

test("materializes the react-spa managed template with the access control overlay", async () => {
  const managedRoot = path.join(outputRoot, "react-spa/managed-v1");
  const packageJson = JSON.parse(
    await readFile(path.join(managedRoot, "package.json"), "utf8"),
  );
  const defaultProviders = await readFile(
    path.join(managedRoot, "src/components/providers/default.tsx"),
    "utf8",
  );
  const app = await readFile(path.join(managedRoot, "src/App.tsx"), "utf8");
  const users = await readFile(
    path.join(managedRoot, "convex/users.ts"),
    "utf8",
  );

  assert.ok(packageJson.dependencies["@usehercules/convex"]);
  assert.match(packageJson.scripts.build, /hercules-convex-access-check/);
  assert.doesNotMatch(defaultProviders, /DeploymentEntryProvider/);
  assert.match(app, /DeploymentEntryProvider/);
  assert.match(app, /path="\/auth\/callback"/);
  assert.match(users, /authenticatedMutation/);
  await readFile(path.join(managedRoot, "hercules/iam.jsonc"));
  await readFile(path.join(managedRoot, "convex/accessUser.ts"));
});

test("materializes the tanstack-start template as a TanStack Start app", async () => {
  const legacyRoot = path.join(outputRoot, "tanstack-start/legacy");
  const packageJson = JSON.parse(
    await readFile(path.join(legacyRoot, "package.json"), "utf8"),
  );

  // TanStack Start base template: file-based routing + Start build, Convex,
  // Hercules auth, and no access-control overlay.
  assert.equal(packageJson.scripts.build, "vite build");
  assert.ok(packageJson.dependencies["@tanstack/react-start"]);
  assert.ok(packageJson.dependencies["@convex-dev/react-query"]);
  assert.ok(packageJson.dependencies["@usehercules/auth-tanstack"]);
  assert.equal(packageJson.dependencies["react-router-dom"], undefined);
  // The client-only SPA auth SDK must not come back alongside the TanStack
  // one: it is what this template replaced, and having both would silently
  // reintroduce browser-held OIDC tokens next to the server session.
  assert.equal(packageJson.dependencies["@usehercules/auth"], undefined);
  assert.equal(packageJson.dependencies["@usehercules/convex"], undefined);

  await access(path.join(legacyRoot, "src/router.tsx"));
  await access(path.join(legacyRoot, "src/routes/__root.tsx"));

  // No legacy React Router entry and no access-control files.
  await assert.rejects(readFile(path.join(legacyRoot, "src/App.tsx")));
  await assert.rejects(readFile(path.join(legacyRoot, "hercules/iam.jsonc")));
  await assert.rejects(readFile(path.join(legacyRoot, "convex/accessUser.ts")));
});

test("does not materialize the paused tanstack-start managed-v1 variant", async () => {
  await assert.rejects(
    access(path.join(outputRoot, "tanstack-start/managed-v1")),
  );
});

test("keeps repository and build-only files out of every variant", async () => {
  for (const variantRoot of variantRoots()) {
    await assert.rejects(readFile(path.join(variantRoot, ".github")));
    await assert.rejects(readFile(path.join(variantRoot, ".git")));
    await assert.rejects(readFile(path.join(variantRoot, "node_modules")));
    await assert.rejects(readFile(path.join(variantRoot, "dist")));
  }
});

test("allows required dependency builds in every variant", async () => {
  for (const variant of templates["react-spa"]) {
    const workspace = await readFile(
      path.join(outputRoot, "react-spa", variant, "pnpm-workspace.yaml"),
      "utf8",
    );

    assert.match(workspace, /"@swc\/core": true/);
    assert.match(workspace, /esbuild: true/);
  }

  const workspace = await readFile(
    path.join(outputRoot, "tanstack-start/legacy/pnpm-workspace.yaml"),
    "utf8",
  );
  assert.match(workspace, /esbuild: true/);
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
