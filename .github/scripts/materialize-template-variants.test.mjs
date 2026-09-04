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
  const convexProviders = await readFile(
    path.join(legacyRoot, "src/components/providers/convex.tsx"),
    "utf8",
  );

  // TanStack Start base template: file-based routing + Start build, Convex,
  // Hercules auth, and no managed IAM overlay.
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
  assert.doesNotMatch(convexProviders, /HerculesIAM/);

  await access(path.join(legacyRoot, "src/router.tsx"));
  await access(path.join(legacyRoot, "src/routes/__root.tsx"));

  // No legacy React Router entry and no managed IAM files.
  await assert.rejects(readFile(path.join(legacyRoot, "src/App.tsx")));
  await assert.rejects(readFile(path.join(legacyRoot, ".hercules/iam.jsonc")));
  await assert.rejects(readFile(path.join(legacyRoot, "convex/iam.ts")));
  await assert.rejects(
    readFile(path.join(legacyRoot, "src/routes/auth/$state.tsx")),
  );
});

test("materializes the managed template with the IAM overlay", async () => {
  const managedRoot = path.join(outputRoot, "managed-v1");
  const packageJson = JSON.parse(
    await readFile(path.join(managedRoot, "package.json"), "utf8"),
  );
  const convexProviders = await readFile(
    path.join(managedRoot, "src/components/providers/convex.tsx"),
    "utf8",
  );
  const users = await readFile(
    path.join(managedRoot, "convex/users.ts"),
    "utf8",
  );

  // Same TanStack Start base, plus the managed IAM package and checks.
  assert.ok(packageJson.dependencies["@tanstack/react-start"]);
  assert.ok(packageJson.dependencies["@usehercules/auth-tanstack"]);
  assert.ok(packageJson.dependencies["@usehercules/convex"]);
  assert.ok(packageJson.dependencies["@usehercules/sdk"]);
  assert.equal(packageJson.dependencies["react-router-dom"], undefined);
  assert.equal(packageJson.dependencies["@usehercules/auth"], undefined);
  assert.match(packageJson.scripts.build, /hercules-convex-iam-check/);
  assert.match(packageJson.scripts.lint, /hercules-convex-iam-check/);

  // The overlay replaces the Convex provider to mount HerculesIAM and adds
  // the IAM wiring, the catalog, and the /auth/* access pages.
  assert.match(convexProviders, /HerculesIAM/);
  assert.match(convexProviders, /ImpersonationBanner/);
  assert.match(users, /protectedMutation/);
  await readFile(path.join(managedRoot, ".hercules/iam.jsonc"));
  await readFile(path.join(managedRoot, "convex/iam.ts"));
  await readFile(path.join(managedRoot, "convex/http.ts"));
  await readFile(
    path.join(managedRoot, "src/components/providers/hercules-iam.tsx"),
  );
  await readFile(path.join(managedRoot, "src/routes/auth/$state.tsx"));
  await readFile(path.join(managedRoot, "pnpm-lock.yaml"));

  // Still no SPA entrypoints.
  await assert.rejects(readFile(path.join(managedRoot, "src/App.tsx")));
  await assert.rejects(readFile(path.join(managedRoot, "hercules/iam.jsonc")));
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
