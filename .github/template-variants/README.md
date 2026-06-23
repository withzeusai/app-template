# App template variants

The repository root is the legacy app template and remains the source for all
files shared by every generated app.

`managed-v1/` is copied over that root when producing the managed IAM
template. Files under the same path replace the legacy version; paths
that do not exist in the root are added only to the managed template.

The release workflow publishes:

- `main.tar.gz` for legacy apps, preserving the existing URL.
- `managed-v1/main.tar.gz` for managed IAM apps.
- Immutable copies of both variants under `releases/<commit-sha>/`.

Run the materializer locally with:

```bash
node .github/scripts/materialize-template-variants.mjs \
  --output-dir /tmp/app-template-variants
```
