import { defineConfig, fromEnv, t } from "@usehercules/olympus/server";

export default defineConfig({
  // Hercules sets these on the app's databases. A deploy fails if one is missing.
  env: {
    HERCULES_OIDC_AUTHORITY: t.string,
    HERCULES_OIDC_CLIENT_ID: t.string,
    HERCULES_API_KEY: t.string,
  },
  auth: {
    providers: [
      {
        issuer: fromEnv("HERCULES_OIDC_AUTHORITY"),
        audience: fromEnv("HERCULES_OIDC_CLIENT_ID"),
      },
    ],
  },
});
