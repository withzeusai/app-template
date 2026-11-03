import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

// What the end-to-end runners share (run.mjs for tanstack-start on Convex,
// run-spa.mjs for react-spa-olympus): running commands and background
// processes, and the throwaway CA the mock OpenID provider's certificate comes
// from.

export const STARTUP_TIMEOUT_MS = 120_000;
// Where Linux distributions keep the system CA bundle. The Convex backend
// still needs public CAs to reach anything else.
const SYSTEM_CA_BUNDLES = [
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
];

const execFileAsync = promisify(execFile);

export function readAppDir(argv) {
  const flagIndex = argv.indexOf("--app-dir");
  const appDir = argv[flagIndex + 1];

  if (flagIndex === -1 || !appDir) {
    throw new Error("Usage: run.mjs --app-dir <path>");
  }

  return path.resolve(appDir);
}

export function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

/** Start a long-running command in its own process group, keeping its output. */
export function startBackground(name, command, args, options) {
  const output = [];
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    ...options,
  });
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.stderr.on("data", (chunk) => output.push(chunk));

  return {
    name,
    child,
    output: () => Buffer.concat(output).toString("utf8"),
    stop: () => {
      if (child.exitCode !== null) return;
      try {
        // Negative pid: the whole group, so the runtimes it started exit too.
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    },
  };
}

export async function waitFor(processHandle, description, isReady) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (processHandle.child.exitCode !== null) {
      throw new Error(
        `${processHandle.name} exited with ${processHandle.child.exitCode} before ${description}`,
      );
    }
    if (await isReady()) return;
    await delay(500);
  }

  throw new Error(
    `${processHandle.name} did not ${description} within ${STARTUP_TIMEOUT_MS} ms`,
  );
}

/** A throwaway CA, and a certificate from it for 127.0.0.1. */
export async function makeCertificates(workDir) {
  const file = (name) => path.join(workDir, name);
  await execFileAsync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=app-template CI e2e CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
    "-keyout",
    file("ca.key"),
    "-out",
    file("ca.crt"),
  ]);
  await execFileAsync("openssl", [
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-subj",
    "/CN=127.0.0.1",
    "-keyout",
    file("server.key"),
    "-out",
    file("server.csr"),
  ]);
  await writeFile(
    file("server.ext"),
    [
      "subjectAltName=IP:127.0.0.1",
      "basicConstraints=CA:FALSE",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage=serverAuth",
    ].join("\n"),
  );
  await execFileAsync("openssl", [
    "x509",
    "-req",
    "-in",
    file("server.csr"),
    "-CA",
    file("ca.crt"),
    "-CAkey",
    file("ca.key"),
    "-CAcreateserial",
    "-days",
    "1",
    "-extfile",
    file("server.ext"),
    "-out",
    file("server.crt"),
  ]);

  const caCert = await readFile(file("ca.crt"), "utf8");
  const systemBundle = SYSTEM_CA_BUNDLES.find((bundle) => existsSync(bundle));
  const bundle =
    (systemBundle ? await readFile(systemBundle, "utf8") : "") + "\n" + caCert;
  await writeFile(file("ca-bundle.crt"), bundle);

  return {
    caFile: file("ca.crt"),
    caBundleFile: file("ca-bundle.crt"),
    key: await readFile(file("server.key")),
    cert: await readFile(file("server.crt")),
  };
}
