// Build the react-spa-olympus/ directory of an explicitly selected internal template branch.
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { copyTrackedTemplate } from "./materialize-templates.mjs";

const { values } = parseArgs({
  options: {
    output: { type: "string" },
    release: { type: "string" },
    sdk: { type: "string" },
    values: { type: "string" },
  },
});
const local = !!values.sdk && !!values.values;
if (
  !values.output ||
  (values.release
    ? values.sdk ||
      values.values ||
      !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(values.release)
    : !local)
) {
  throw new Error(
    "Use --output <new app directory> with --release <exact Olympus version> or --sdk <packed SDK> --values <packed values>.",
  );
}
const repo = fileURLToPath(new URL("../..", import.meta.url));
const output = path.resolve(values.output);
await mkdir(output); // A user's existing directory must never be replaced.
await copyTrackedTemplate(repo, "react-spa-olympus", output);
for (const file of [
  "backend/users.ts",
  "backend/users.test.ts",
  "backend/.olympus",
]) {
  await rm(path.join(output, file), { recursive: true });
}
await copyTrackedTemplate(
  repo,
  ".github/pilots/organization-permissions",
  output,
);
const manifest = JSON.parse(
  await readFile(path.join(output, "package.json"), "utf8"),
);
if (local) {
  await mkdir(path.join(output, "vendor"));
  for (const name of ["sdk", "values"]) {
    await copyFile(values[name], path.join(output, "vendor", name + ".tgz"));
  }
  manifest.dependencies["@usehercules/olympus"] = "file:vendor/sdk.tgz";
  // The packed SDK's values dependency must resolve to the matching local build.
  const workspace = path.join(output, "pnpm-workspace.yaml");
  const config = await readFile(workspace, "utf8");
  if (!config.includes("\noverrides:\n"))
    throw new Error("The template needs a pnpm overrides section");
  await writeFile(
    workspace,
    config.replace(
      "\noverrides:\n",
      '\noverrides:\n  "@usehercules/olympus-values": "file:vendor/values.tgz"\n',
    ),
  );
  delete manifest.devDependencies["@usehercules/olympus-server"];
} else {
  manifest.dependencies["@usehercules/olympus"] = values.release;
  manifest.devDependencies["@usehercules/olympus-server"] = values.release;
}
await writeFile(
  path.join(output, "package.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const run = (...args) =>
  execFileSync("pnpm", args, { cwd: output, stdio: "inherit" });
run("install", "--no-frozen-lockfile");
run("exec", "olympus", "codegen");
run("exec", "tsc", "--noEmit", "-p", "backend");
