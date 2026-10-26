import { AuthConfig } from "convex/server";
import { env } from "./_generated/server";

export default {
  providers: [
    {
      domain: env.HERCULES_OIDC_AUTHORITY,
      applicationID: env.HERCULES_OIDC_CLIENT_ID,
    },
  ],
} satisfies AuthConfig;
