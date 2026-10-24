# Hercules app templates

The starting points Hercules scaffolds new apps from. Each top-level directory
is one complete template:

| Directory         | `templateKind`   | Stack                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------ |
| `react-spa/`      | `react-spa`      | Vite and React Router single-page app, Convex, Hercules auth |
| `tanstack-start/` | `tanstack-start` | TanStack Start on Cloudflare Workers, Convex, Hercules auth  |

Everything inside a template directory ships to every app made from it.
Repository tooling lives only in `.github/`.

## Working on a template

Each template is a standalone pnpm project with its own lockfile, so run
commands from its directory:

```bash
cd tanstack-start
pnpm install
pnpm dev
```

A change that applies to every template (a shared component, a dependency
bump, an auth fix) can land in one pull request that edits each directory.

## Variants

A variant is a template with an overlay from
`.github/template-variants/<template>/<variant>/` copied over it. See
[`.github/template-variants/README.md`](.github/template-variants/README.md).

## CI

`ci.yml` materializes every variant and runs its install, lint, format check,
type checks, build, and tests. `tanstack-start` also checks its committed route
tree and runs an SSR smoke test against a production build.

## Publishing

On every push to `main`, `package-and-upload.yml` uploads each variant to the
`hercules-app-templates` bucket (served at `https://app-templates.hercules.app`):

| Path                                                               | Contents                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `<template>/main.tar.gz`                                           | The template                                                   |
| `<template>/<variant>/main.tar.gz`                                 | A variant, such as `managed-v1`                                |
| `releases/<sha>/<template>/<variant>.tar.gz`                       | Immutable copy of a variant (`legacy` is the template itself)  |
| `main.tar.gz`, `managed-v1/main.tar.gz`                            | `react-spa`, at its older paths (Hercules reads `main.tar.gz`) |
| `releases/<sha>/legacy.tar.gz`, `releases/<sha>/managed-v1.tar.gz` | `react-spa`, immutable, at its older paths                     |

### The `migrate/tanstack-start` branch

Hercules still creates TanStack Start apps by cloning the
`migrate/tanstack-start` branch. Until it reads `tanstack-start/` from `main`,
`sync-tanstack-start-branch.yml` commits `tanstack-start/` onto that branch
after every push to `main` that changes it. Make TanStack Start changes on
`main`, not on the branch.

If something is pushed to the branch anyway, the sync refuses to replace it.
Port each such commit with
`git cherry-pick -Xsubtree=tanstack-start <commit>` on `main`, then run the
workflow by hand with `overwrite` checked.

## Adding a template

1. Add the template as a new top-level directory with its own `package.json`
   and `pnpm-lock.yaml`.
2. Add it to `templates` in `.github/scripts/materialize-template-variants.mjs`.
3. Add it to the `check` matrix in `.github/workflows/ci.yml`.
4. Add its directory to the npm entry in `.github/dependabot.yml`.
