import { internal } from "./_generated/api";
import { type ActionCtx, internalMutation } from "./_generated/server";

/**
 * Signs a short-lived token that proves this deployment's identity to
 * Hercules. Hercules checks it against this deployment's public keys, so the
 * token works anywhere `HERCULES_API_KEY` does and expires after 15 minutes.
 *
 * Keep this internal. A public function would hand the token to any client.
 */
export const signToken = internalMutation({
  args: {},
  handler: async (ctx): Promise<string> =>
    await ctx.auth.signJwt({
      claims: { aud: "https://api.hercules.app" },
      expiresInSeconds: 900,
    }),
});

/**
 * A token for calling Hercules from an action, in place of
 * `HERCULES_API_KEY`. It outlives the action, so get one at the top and reuse
 * it:
 *
 *   const hercules = new Hercules({ apiKey: await herculesToken(ctx) });
 */
export function herculesToken(
  ctx: Pick<ActionCtx, "runMutation">,
): Promise<string> {
  return ctx.runMutation(internal.hercules.signToken, {});
}
