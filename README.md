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

## CI

`ci.yml` copies each template's tracked files out of the repository and runs
its install, lint, format check, type checks, build, and tests.
`tanstack-start` also checks its committed route tree and runs an SSR smoke
test against a production build.

## Publishing

On every push to `main`, `package-and-upload.yml` uploads each template to the
`hercules-app-templates` bucket (served at `https://app-templates.hercules.app`):

| Path                               | Contents                                             |
| ---------------------------------- | ---------------------------------------------------- |
| `<template>/main.tar.gz`           | The template                                         |
| `releases/<sha>/<template>.tar.gz` | Immutable copy of the template                       |
| `main.tar.gz`                      | `react-spa`, at its older path, which Hercules reads |
| `releases/<sha>/legacy.tar.gz`     | `react-spa`, immutable, at its older path            |

## Adding a template

1. Add the template as a new top-level directory with its own `package.json`
   and `pnpm-lock.yaml`.
2. Add it to `templates` in `.github/scripts/materialize-templates.mjs`.
3. Add it to the `check` matrix in `.github/workflows/ci.yml`.
4. Add its directory to the npm entry in `.github/dependabot.yml`.
