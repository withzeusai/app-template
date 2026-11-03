import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

// End-to-end check of sign-in in the react-spa-olympus template: its
// production build, served by `vite preview`, signs in through a mock OpenID
// provider in the browser and talks to a real olympus-server, started from
// the app's own @usehercules/olympus-server. The checks pass when, for example, the user's
// row is never made because the callback's mutation ran before the backend had
// the token.
//
// The provider is HTTPS, as Hercules Auth is, so this makes a throwaway CA for
// it, which the server trusts through SSL_CERT_FILE when it fetches the
// provider's keys. The browser is told to ignore the certificate.

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(E2E_DIR, "spa", "CiE2e.tsx");
const PORT = 4175;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SERVER_ADDR = "127.0.0.1:3299";
const SERVER_URL = `http://${SERVER_ADDR}`;
const CLIENT_ID = "ci-e2e";
const DB = "app";
/** Where the template's App.tsx says custom routes go. */
const ROUTES_MARKER =
  '{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}';

async function main() {
  const appDir = readAppDir(process.argv.slice(2));
  const workDir = await mkdtemp(path.join(tmpdir(), "ci-e2e-spa-"));
  const app = path.join(appDir, "src", "App.tsx");
  const page = path.join(appDir, "src", "pages", "CiE2e.tsx");
  const original = await readFile(app, "utf8");
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

    // The test page, at /ci-e2e.
    if (!original.includes(ROUTES_MARKER)) {
      throw new Error(
        `App.tsx has no ${ROUTES_MARKER} to add the test route at`,
      );
    }
    await copyFile(PAGE, page);
    await writeFile(
      app,
      original
        .replace(
          'import Index from "./pages/Index.tsx";',
          'import Index from "./pages/Index.tsx";\nimport CiE2e from "./pages/CiE2e.tsx";',
        )
        .replace(
          ROUTES_MARKER,
          `<Route path="/ci-e2e" element={<CiE2e />} />\n          ${ROUTES_MARKER}`,
        ),
    );

    const server = startBackground(
      "olympus-server",
      "pnpm",
      [
        "exec",
        "olympus-server",
        "--dev",
        "--addr",
        SERVER_ADDR,
        "--store",
        `sqlite:${path.join(workDir, "e2e.sqlite")}`,
      ],
      {
        cwd: appDir,
        env: { ...process.env, SSL_CERT_FILE: certificates.caBundleFile },
      },
    );
    background.push(server);
    await waitFor(server, "answer", async () => {
      try {
        return (await fetch(`${SERVER_URL}/api/health`)).ok;
      } catch {
        return false;
      }
    });

    // The variables first: a deploy without the declared ones fails.
    const cli = ["exec", "olympus", "--url", SERVER_URL, "--db", DB];
    for (const [name, value] of [
      ["HERCULES_OIDC_AUTHORITY", provider.issuer],
      ["HERCULES_OIDC_CLIENT_ID", CLIENT_ID],
      ["HERCULES_API_KEY", "ci-e2e-api-key"],
    ]) {
      await run("pnpm", [...cli, "env", "set", name, value], { cwd: appDir });
    }
    await run("pnpm", [...cli, "deploy"], { cwd: appDir });

    const appEnv = {
      ...process.env,
      VITE_HERCULES_OIDC_AUTHORITY: provider.issuer,
      VITE_HERCULES_OIDC_CLIENT_ID: CLIENT_ID,
      VITE_OLYMPUS_URL: SERVER_URL,
      VITE_OLYMPUS_DB: DB,
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
            E2E_SPECS: "olympus-*.spec.mjs",
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
    await writeFile(app, original);
    await rm(page, { force: true });
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
