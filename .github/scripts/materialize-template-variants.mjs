import { execFile } from "node:child_process";
import { chmod, copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

/**
 * Every template directory at the repository root, with the variants built
 * from it. "legacy" is the template as committed; any other variant is the
 * template with `.github/template-variants/<template>/<variant>/` copied over
 * it.
 */
export const templates = {
  "react-spa": ["legacy", "managed-v1"],
  // The tanstack-start managed-v1 overlay still targets the React Router app
  // and is paused until it is ported to TanStack Start.
  "tanstack-start": ["legacy"],
};

function containsPath(parent, child) {
  const relative = path.relative(parent, child);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

/** Tracked files of `template`, relative to its directory. */
async function listTemplateFiles(repositoryRoot, template) {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--", template],
    {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const prefix = `${template}/`;

  return stdout
    .toString("utf8")
    .split("\0")
    .filter((file) => file.startsWith(prefix))
    .map((file) => file.slice(prefix.length));
}

async function copyTrackedTemplate(repositoryRoot, template, destinationRoot) {
  const files = await listTemplateFiles(repositoryRoot, template);

  if (files.length === 0) {
    throw new Error(`Template "${template}" has no tracked files`);
  }

  for (const file of files) {
    const source = path.join(repositoryRoot, template, file);
    const destination = path.join(destinationRoot, file);
    const sourceStat = await stat(source);

    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    await chmod(destination, sourceStat.mode);
  }
}

/**
 * Writes each variant of each template to `<outputRoot>/<template>/<variant>`
 * and returns those paths, keyed by template and then variant.
 */
export async function materializeTemplateVariants({
  repositoryRoot,
  outputRoot,
}) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedOutputRoot = path.resolve(outputRoot);

  if (
    containsPath(resolvedRepositoryRoot, resolvedOutputRoot) ||
    containsPath(resolvedOutputRoot, resolvedRepositoryRoot)
  ) {
    throw new Error(
      "Template output directory and repository must not overlap",
    );
  }

  await rm(resolvedOutputRoot, { force: true, recursive: true });

  const roots = {};
  for (const [template, variants] of Object.entries(templates)) {
    roots[template] = {};
    for (const variant of variants) {
      const variantRoot = path.join(resolvedOutputRoot, template, variant);

      await mkdir(variantRoot, { recursive: true });
      await copyTrackedTemplate(resolvedRepositoryRoot, template, variantRoot);
      if (variant !== "legacy") {
        await cp(
          path.join(
            resolvedRepositoryRoot,
            ".github/template-variants",
            template,
            variant,
          ),
          variantRoot,
          { force: true, recursive: true },
        );
      }
      roots[template][variant] = variantRoot;
    }
  }

  return roots;
}

function readOutputRoot(argv) {
  const outputFlagIndex = argv.indexOf("--output-dir");
  const outputRoot = argv[outputFlagIndex + 1];

  if (outputFlagIndex === -1 || !outputRoot) {
    throw new Error("Usage: materialize-template-variants --output-dir <path>");
  }

  return outputRoot;
}

const isCommandLine =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLine) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );

  await materializeTemplateVariants({
    repositoryRoot,
    outputRoot: readOutputRoot(process.argv.slice(2)),
  });
}
