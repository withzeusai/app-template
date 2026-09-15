# App template variants

> **Status:** `managed-v1/` is **paused**. The repository root has migrated to
> TanStack Start, but the overlay below still targets the old React Router app,
> so the materializer, CI, and release workflow currently build the `legacy`
> (base) template only. The overlay is kept here as the reference for porting
> the managed Access Control variant to TanStack Start. Re-enable it by
> restoring the managed branch in `materialize-template-variants.mjs`, the CI
> matrix, and `package-and-upload.yml`.

The repository root is the legacy app template and remains the source for all
files shared by every generated app.

`managed-v1/` is copied over that root when producing the managed Access
Control template. Files under the same path replace the legacy version; paths
that do not exist in the root are added only to the managed template.

The release workflow (`package-and-upload.yml`) publishes each packaged
scaffold under its own key prefix in the `hercules-app-templates` bucket:

| Branch                   | Prefix            | Keys                                                                   |
| ------------------------ | ----------------- | ---------------------------------------------------------------------- |
| `main`                   | (none)            | `main.tar.gz`, `managed-v1/main.tar.gz`, `releases/<commit-sha>/…`     |
| `migrate/tanstack-start` | `tanstack-start/` | `tanstack-start/main.tar.gz`, `tanstack-start/releases/<commit-sha>/…` |

- `<prefix>main.tar.gz` is the legacy (base) app, preserving the existing URL.
- `<prefix>managed-v1/main.tar.gz` is the managed Access Control app. It is
  uploaded only when the materializer produced the `managed-v1` variant on
  that branch, so the paused TanStack overlay does not block publishing.
- Immutable copies of every uploaded variant live under
  `<prefix>releases/<commit-sha>/`.

Run the materializer locally with:

```bash
node .github/scripts/materialize-template-variants.mjs \
  --output-dir /tmp/app-template-variants
```
