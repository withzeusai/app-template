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
import { fileURLToPath } from "node:url";
import {
  makeCertificates,
  readAppDir,
  run,
  startBackground,
  waitFor,
} from "./harness.mjs";
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
            E2E_SPECS: "convex-*.spec.mjs",
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
