# App template variants

The repository root is the legacy app template and remains the source for all
files shared by every generated app.

`managed-v1/` is copied over that root when producing the managed IAM
template. Files under the same path replace the legacy version; paths that do
not exist in the root are added only to the managed template. herculesd applies
the overlay the same way (a recursive copy over a clone of this branch) when it
scaffolds an app whose `accessControlMode` is `managed_v1`, so the overlay must
stay a plain file overlay: no build step, and `package.json` +
`pnpm-lock.yaml` must be complete, installable copies.

## What the managed overlay adds (TanStack Start)

- `.hercules/iam.jsonc` — the IAM catalog (permissions, resource types, roles).
- `convex/iam.ts` — `createAccess` wiring: `access`, `protectedQuery`,
  `protectedMutation`, `protectedAction`, plus `evaluateAccess` (deployment
  entry) and `getTenantAccessStatus`.
- `convex/convex.config.ts`, `convex/http.ts` — the `@usehercules/convex`
  component and its sync webhook routes; `convex/users.ts` on the protected
  builders; `convex/_generated/api.d.ts` with the new modules.
- `src/components/providers/hercules-iam.tsx` — `HerculesIAM` (deployment entry
  after sign-in, IAM error boundary, watchdog), `RequireSignIn`, the access
  state screens, and `IamAccessRoute`.
- `src/components/providers/convex.tsx` — the base provider plus `HerculesIAM`
  and the impersonation banner; the only base file the overlay replaces.
- `src/components/providers/impersonation-banner.tsx` — built on
  `useAuth().impersonator` from `@usehercules/auth-tanstack/client`.
- `src/routes/auth/$state.tsx` — the `/auth/pending-approval`, `/auth/blocked`,
  `/auth/suspended`, `/auth/removed`, `/auth/missing`, and
  `/auth/access-denied` pages. `src/routeTree.gen.ts` is generated, so it is
  not part of the overlay.
- `package.json` — the base manifest plus `@usehercules/convex`,
  `@usehercules/sdk`, and the `hercules-convex-iam-check` build/lint steps;
  `pnpm-lock.yaml` regenerated for it.

The overlay is a partial overlay by design: its files only type-check, lint,
and test in a materialized template.

## Updating the overlay

After changing `package.json`, regenerate the lockfile from a materialized
managed template so the two stay in sync:

```bash
node .github/scripts/materialize-template-variants.mjs \
  --output-dir /tmp/app-template-variants
(cd /tmp/app-template-variants/managed-v1 && pnpm install --lockfile-only)
cp /tmp/app-template-variants/managed-v1/pnpm-lock.yaml \
  .github/template-variants/managed-v1/pnpm-lock.yaml
```

CI runs the full template checks (install, routes, lint, format, type check,
build, Convex type check, tests) against both materialized variants.

## Release

The release workflow publishes:

- `main.tar.gz` for legacy apps, preserving the existing URL.
- `managed-v1/main.tar.gz` for managed IAM apps.
- Immutable copies of both variants under `releases/<commit-sha>/`.

Run the materializer locally with:

```bash
node .github/scripts/materialize-template-variants.mjs \
  --output-dir /tmp/app-template-variants
```
