import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { startOidcProvider, TEST_USER } from "./oidc-provider.mjs";

// End-to-end check of Convex auth in the tanstack-start template: the browser
// talks to a real local Convex backend while signed in through a mock OpenID
// provider, against the production build served by `vite preview` (the
// Worker runtime the app deploys to). Lint, type check, and the SSR smoke test
// all pass when, for example, a signed-in page's queries reach Convex before
// the session's token and replace the server-rendered data.
//
// The provider must be HTTPS (openid-client refuses HTTP issuers), so this
// makes a throwaway CA for it and has both the Worker runtime
// (NODE_EXTRA_CA_CERTS, read by Miniflare) and the Convex backend
// (SSL_CERT_FILE) trust it.

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.join(E2E_DIR, "routes");
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CLIENT_ID = "ci-e2e";
const STARTUP_TIMEOUT_MS = 120_000;
// Where Linux distributions keep the system CA bundle. The Convex backend
// still needs public CAs to reach anything else.
const SYSTEM_CA_BUNDLES = [
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
];

const execFileAsync = promisify(execFile);

function readAppDir(argv) {
  const flagIndex = argv.indexOf("--app-dir");
  const appDir = argv[flagIndex + 1];

  if (flagIndex === -1 || !appDir) {
    throw new Error("Usage: run.mjs --app-dir <path>");
  }

  return path.resolve(appDir);
}

function run(command, args, options) {
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
function startBackground(name, command, args, options) {
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

async function waitFor(processHandle, description, isReady) {
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
async function makeCertificates(workDir) {
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

function readEnvFile(text, name) {
  const line = text
    .split("\n")
    .find((candidate) => candidate.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

async function main() {
  const appDir = readAppDir(process.argv.slice(2));
  const workDir = await mkdtemp(path.join(tmpdir(), "ci-e2e-"));
  const routeFiles = (await readdir(ROUTES_DIR)).map((name) => ({
    from: path.join(ROUTES_DIR, name),
    to: path.join(appDir, "src", "routes", name),
  }));
  const devVarsFile = path.join(appDir, ".dev.vars");
  const background = [];
  let provider;

  try {
    const certificates = await makeCertificates(workDir);
    provider = await startOidcProvider({
      key: certificates.key,
      cert: certificates.cert,
      clientId: CLIENT_ID,
    });
    console.log(`Mock OpenID provider at ${provider.issuer}`);

    for (const route of routeFiles) await copyFile(route.from, route.to);

    // An anonymous local deployment: no Convex account, state under the home
    // directory. The backend verifies ID tokens against the provider, so it
    // must trust the CA.
    const convexEnv = {
      ...process.env,
      CONVEX_AGENT_MODE: "anonymous",
      SSL_CERT_FILE: certificates.caBundleFile,
    };
    // The first push needs these, and setting them needs a deployment, which
    // only `convex dev` configures. So configure it with a push that fails.
    await run(
      "pnpm",
      ["exec", "convex", "dev", "--once", "--typecheck", "disable"],
      { cwd: appDir, env: convexEnv },
    ).catch(() => {});
    for (const [name, value] of [
      ["HERCULES_OIDC_AUTHORITY", provider.issuer],
      ["HERCULES_OIDC_CLIENT_ID", CLIENT_ID],
      ["HERCULES_API_KEY", "ci-e2e-api-key"],
    ]) {
      await run("pnpm", ["exec", "convex", "env", "set", name, value], {
        cwd: appDir,
        env: convexEnv,
      });
    }

    const convex = startBackground(
      "convex dev",
      "pnpm",
      [
        "exec",
        "convex",
        "dev",
        "--typecheck",
        "disable",
        "--tail-logs",
        "disable",
      ],
      { cwd: appDir, env: convexEnv },
    );
    background.push(convex);
    await waitFor(convex, "push the functions", async () =>
      convex.output().includes("Convex functions ready"),
    );

    const envLocal = await readFile(path.join(appDir, ".env.local"), "utf8");
    const convexUrl = readEnvFile(envLocal, "VITE_CONVEX_URL");
    if (!convexUrl) throw new Error(".env.local has no VITE_CONVEX_URL");

    // The Worker's own environment, which `process.env` reads.
    await writeFile(
      devVarsFile,
      [
        `HERCULES_OIDC_AUTHORITY=${provider.issuer}`,
        `HERCULES_OIDC_CLIENT_ID=${CLIENT_ID}`,
        `HERCULES_AUTH_COOKIE_PASSWORD=${"ci-e2e-cookie-password-".repeat(2)}`,
      ].join("\n") + "\n",
    );

    const appEnv = {
      ...process.env,
      VITE_CONVEX_URL: convexUrl,
      NODE_EXTRA_CA_CERTS: certificates.caFile,
    };
    await run("pnpm", ["build"], { cwd: appDir, env: appEnv });

    const preview = startBackground(
      "vite preview",
      "pnpm",
      [
        "exec",
        "vite",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        String(PORT),
        "--strictPort",
      ],
      { cwd: appDir, env: appEnv },
    );
    background.push(preview);
    await waitFor(preview, "answer", async () => {
      try {
        await fetch(BASE_URL, { signal: AbortSignal.timeout(2_000) });
        return true;
      } catch {
        return false;
      }
    });

    try {
      await run(
        "pnpm",
        ["exec", "playwright", "test", "--config", "playwright.config.mjs"],
        {
          cwd: E2E_DIR,
          env: {
            ...process.env,
            E2E_BASE_URL: BASE_URL,
            E2E_USER_EMAIL: TEST_USER.email,
          },
        },
      );
    } catch (error) {
      for (const handle of background) {
        console.error(`\n${handle.name} output:\n${handle.output()}`);
      }
      throw error;
    }
  } finally {
    for (const handle of background.reverse()) handle.stop();
    await provider?.close();
    for (const route of routeFiles) await rm(route.to, { force: true });
    await rm(devVarsFile, { force: true });
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
