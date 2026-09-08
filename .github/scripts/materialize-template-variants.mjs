import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repositoryOnlyPrefixes = [".github/"];

function containsPath(parent, child) {
  const relative = path.relative(parent, child);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

async function listTemplateFiles(repositoryRoot) {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter(
      (file) =>
        !repositoryOnlyPrefixes.some((prefix) => file.startsWith(prefix)),
    );
}

async function copyTrackedTemplate(repositoryRoot, destinationRoot) {
  const files = await listTemplateFiles(repositoryRoot);

  for (const file of files) {
    const source = path.join(repositoryRoot, file);
    const destination = path.join(destinationRoot, file);
    const sourceStat = await stat(source);

    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    await chmod(destination, sourceStat.mode);
  }
}

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

  // Only the legacy (base) template ships today. The managed-v1 access-control
  // overlay under .github/template-variants/managed-v1 still targets the old
  // React Router app and is paused until it is migrated to TanStack Start.
  const legacyRoot = path.join(resolvedOutputRoot, "legacy");

  await rm(resolvedOutputRoot, { force: true, recursive: true });
  await mkdir(legacyRoot, { recursive: true });

  await copyTrackedTemplate(resolvedRepositoryRoot, legacyRoot);

  return { legacyRoot };
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
