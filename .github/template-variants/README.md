# App template variants

Each template directory at the repository root (`react-spa/`,
`tanstack-start/`) is that template's `legacy` variant and the source for every
file its variants share.

`<template>/<variant>/` here is copied over that template when producing the
variant. Files under the same path replace the template's version; paths that
do not exist in the template are added only to the variant.

| Variant                     | Status                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `react-spa/managed-v1`      | Published. The managed Access Control template.                                                     |
| `tanstack-start/managed-v1` | Paused. Still targets the React Router app; kept as the reference for porting it to TanStack Start. |

The variants each template builds are listed in `templates` in
`.github/scripts/materialize-template-variants.mjs`; a paused variant is left
out of that list. The release workflow publishes `<template>/main.tar.gz` for
each template and `<template>/<variant>/main.tar.gz` for each variant, with
immutable copies under `releases/<commit-sha>/<template>/`. The repository
[README](../../README.md) lists every published path.

Run the materializer locally with:

```bash
node .github/scripts/materialize-template-variants.mjs \
  --output-dir /tmp/app-template-variants
```

It writes each variant to `/tmp/app-template-variants/<template>/<variant>/`.
