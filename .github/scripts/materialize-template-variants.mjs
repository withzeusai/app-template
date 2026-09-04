import { execFile } from "node:child_process";
import { chmod, copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
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

  // Two variants ship: the legacy (base) template as tracked in the repository
  // root, and the managed IAM template, which is the same root with the
  // .github/template-variants/managed-v1 overlay copied over it (matching how
  // herculesd applies the overlay when it scaffolds a managed_v1 app).
  const legacyRoot = path.join(resolvedOutputRoot, "legacy");
  const managedRoot = path.join(resolvedOutputRoot, "managed-v1");
  const managedOverlay = path.join(
    resolvedRepositoryRoot,
    ".github/template-variants/managed-v1",
  );

  await rm(resolvedOutputRoot, { force: true, recursive: true });
  await mkdir(legacyRoot, { recursive: true });
  await mkdir(managedRoot, { recursive: true });

  await copyTrackedTemplate(resolvedRepositoryRoot, legacyRoot);
  await copyTrackedTemplate(resolvedRepositoryRoot, managedRoot);
  await cp(managedOverlay, managedRoot, {
    force: true,
    recursive: true,
  });

  return { legacyRoot, managedRoot };
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
