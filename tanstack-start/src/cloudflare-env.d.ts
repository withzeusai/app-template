// The Worker's bindings, as server code sees them through
// `import { env } from "cloudflare:workers"`.
declare module "cloudflare:workers" {
  export const env: {
    /** Set by Hercules when the app is published. Absent on a dev machine. */
    HERCULES?: { token(): Promise<string> };
  };
}
