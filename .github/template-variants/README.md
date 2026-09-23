# App template variants

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

## Localize the auth callback

Both variants share `src/pages/auth/Callback.tsx`. Pass app-selected copy from
the route without changing the managed callback's authentication flow:

```tsx
import AuthCallback from "./pages/auth/Callback.tsx";
import { authCallbackMessages } from "./pages/auth/callback-messages.ts";

<Route
  path="/auth/callback"
  element={<AuthCallback messages={authCallbackMessages.de} />}
/>;
```

English is the default. The `de` preset includes German loading, error,
recovery, and button text. Apps can pass any complete `AuthCallbackMessages`
object from their own translations, or spread a preset to override selected
strings. The app selects the language; the callback does not guess it from
the browser or change any redirects.

The missing-state message tells users to reopen the original link in a
browser and sign in again. Other provider and backend error details are
preserved. OAuth state validation and retry behavior are unchanged.

Existing generated apps are snapshots: this template update does not rewrite
their files. They must adopt the updated `Callback.tsx` and its
`callback-messages.ts` module before using the `messages` prop.
