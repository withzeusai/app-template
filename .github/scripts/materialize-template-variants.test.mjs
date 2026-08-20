import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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

test("materializes the legacy template as a TanStack Start app", async () => {
  const legacyRoot = path.join(outputRoot, "legacy");
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

test("does not materialize the paused managed-v1 variant", async () => {
  await assert.rejects(access(path.join(outputRoot, "managed-v1")));
});

test("keeps repository and build-only files out of the template", async () => {
  const legacyRoot = path.join(outputRoot, "legacy");

  await assert.rejects(readFile(path.join(legacyRoot, ".github")));
  await assert.rejects(readFile(path.join(legacyRoot, ".git")));
  await assert.rejects(readFile(path.join(legacyRoot, "node_modules")));
  await assert.rejects(readFile(path.join(legacyRoot, "dist")));
});

test("allows required dependency builds", async () => {
  const workspace = await readFile(
    path.join(outputRoot, "legacy", "pnpm-workspace.yaml"),
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
