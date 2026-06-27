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

The release workflow publishes:

- `main.tar.gz` for legacy apps, preserving the existing URL.
- `managed-v1/main.tar.gz` for managed Access Control apps.
- Immutable copies of both variants under `releases/<commit-sha>/`.

Run the materializer locally with:

```bash
node .github/scripts/materialize-template-variants.mjs \
  --output-dir /tmp/app-template-variants
```
