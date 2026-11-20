import { createFileRoute } from "@tanstack/react-router";
import { herculesToken } from "@/lib/hercules-token.ts";

// Reports which credential server code gets, without returning it. The build
// under test has no `HERCULES` binding, so this is the API key fallback.
export const Route = createFileRoute("/ci-e2e-hercules-token")({
  server: {
    handlers: {
      GET: async () => {
        const credential = await herculesToken();
        return Response.json({
          isApiKey: credential === process.env.HERCULES_API_KEY,
          length: credential.length,
        });
      },
    },
  },
});
