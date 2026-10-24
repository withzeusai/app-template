import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

/** Every template directory at the repository root. */
export const templates = ["react-spa", "tanstack-start"];

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
 * Copies the tracked files of each template to `<outputRoot>/<template>`, so
 * what is checked and published is exactly what is committed, and returns
 * those paths keyed by template.
 */
export async function materializeTemplates({ repositoryRoot, outputRoot }) {
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
  for (const template of templates) {
    const templateRoot = path.join(resolvedOutputRoot, template);

    await mkdir(templateRoot, { recursive: true });
    await copyTrackedTemplate(resolvedRepositoryRoot, template, templateRoot);
    roots[template] = templateRoot;
  }

  return roots;
}

function readOutputRoot(argv) {
  const outputFlagIndex = argv.indexOf("--output-dir");
  const outputRoot = argv[outputFlagIndex + 1];

  if (outputFlagIndex === -1 || !outputRoot) {
    throw new Error("Usage: materialize-templates --output-dir <path>");
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

  await materializeTemplates({
    repositoryRoot,
    outputRoot: readOutputRoot(process.argv.slice(2)),
  });
}
