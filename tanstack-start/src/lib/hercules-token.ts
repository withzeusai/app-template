import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

/**
 * A credential for calling Hercules from server code (server functions,
 * server routes, loaders that run on the server). Use it wherever
 * `HERCULES_API_KEY` would go:
 *
 *   const hercules = new Hercules({ apiKey: await herculesToken() });
 *
 * A published app has a `HERCULES` binding that hands out a token proving
 * which app is calling. It lasts 15 minutes, so ask for one per request and
 * do not store it. On a dev machine there is no binding and this returns
 * `HERCULES_API_KEY`.
 *
 * Server only: never return it from a server function or send it to the
 * browser.
 */
export const herculesToken = createServerOnlyFn(async (): Promise<string> => {
  if (env.HERCULES) return env.HERCULES.token();
  const apiKey = process.env.HERCULES_API_KEY;
  if (!apiKey) throw new Error("HERCULES_API_KEY is not set.");
  return apiKey;
});
