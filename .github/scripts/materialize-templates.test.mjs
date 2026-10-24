import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { materializeTemplates, templates } from "./materialize-templates.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

let outputRoot;

before(async () => {
  outputRoot = await mkdtemp(path.join(os.tmpdir(), "app-templates-"));
  await materializeTemplates({ repositoryRoot, outputRoot });
});

after(async () => {
  await rm(outputRoot, { force: true, recursive: true });
});

async function trackedFiles() {
  const { stdout } = await promisify(execFile)("git", ["ls-files"], {
    cwd: repositoryRoot,
  });

  return stdout.split("\n").filter(Boolean);
}

async function readPackageJson(template) {
  return JSON.parse(
    await readFile(path.join(outputRoot, template, "package.json"), "utf8"),
  );
}

test("lists every template directory in the repository", async () => {
  const templateDirectories = (await trackedFiles())
    .filter((file) => /^[^/.][^/]*\/package\.json$/.test(file))
    .map((file) => file.split("/")[0])
    .sort();

  assert.deepEqual(templateDirectories, [...templates].sort());
});

// A change ported from before the templates moved into their directories can
// leave a new file at its old path, such as public/favicon.ico, where no
// template ships it.
test("keeps every file in a template directory or .github", async () => {
  const roots = new Set([...templates, ".github"]);
  const strays = (await trackedFiles()).filter(
    (file) => file !== "README.md" && !roots.has(file.split("/")[0]),
  );

  assert.deepEqual(strays, []);
});

test("materializes the react-spa template as a Vite single-page app", async () => {
  const root = path.join(outputRoot, "react-spa");
  const packageJson = await readPackageJson("react-spa");

  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.ok(packageJson.dependencies["react-router-dom"]);
  assert.equal(packageJson.dependencies["@tanstack/react-start"], undefined);

  await access(path.join(root, "index.html"));
  await access(path.join(root, "src/App.tsx"));
});

test("materializes the tanstack-start template as a TanStack Start app", async () => {
  const root = path.join(outputRoot, "tanstack-start");
  const packageJson = await readPackageJson("tanstack-start");

  // TanStack Start base template: file-based routing + Start build, Convex,
  // and Hercules auth.
  assert.equal(packageJson.scripts.build, "vite build");
  assert.ok(packageJson.dependencies["@tanstack/react-start"]);
  assert.ok(packageJson.dependencies["@convex-dev/react-query"]);
  assert.ok(packageJson.dependencies["@usehercules/auth-tanstack"]);
  assert.equal(packageJson.dependencies["react-router-dom"], undefined);
  // The client-only SPA auth SDK must not come back alongside the TanStack
  // one: it is what this template replaced, and having both would silently
  // reintroduce browser-held OIDC tokens next to the server session.
  assert.equal(packageJson.dependencies["@usehercules/auth"], undefined);

  await access(path.join(root, "src/router.tsx"));
  await access(path.join(root, "src/routes/__root.tsx"));

  // No legacy React Router entry.
  await assert.rejects(readFile(path.join(root, "src/App.tsx")));
});

test("keeps repository and build-only files out of every template", async () => {
  for (const template of templates) {
    const root = path.join(outputRoot, template);

    await assert.rejects(readFile(path.join(root, ".github")));
    await assert.rejects(readFile(path.join(root, ".git")));
    await assert.rejects(readFile(path.join(root, "node_modules")));
    await assert.rejects(readFile(path.join(root, "dist")));
  }
});

test("allows required dependency builds in every template", async () => {
  const workspaces = Object.fromEntries(
    await Promise.all(
      templates.map(async (template) => [
        template,
        await readFile(
          path.join(outputRoot, template, "pnpm-workspace.yaml"),
          "utf8",
        ),
      ]),
    ),
  );

  assert.match(workspaces["react-spa"], /"@swc\/core": true/);
  for (const workspace of Object.values(workspaces)) {
    assert.match(workspace, /esbuild: true/);
  }
});

test("rejects an output directory that overlaps the repository", async () => {
  const nestedOutput = path.join(repositoryRoot, ".template-output-test");

  try {
    await assert.rejects(
      materializeTemplates({
        repositoryRoot,
        outputRoot: nestedOutput,
      }),
      /must not overlap/,
    );
  } finally {
    await rm(nestedOutput, { force: true, recursive: true });
  }
});
