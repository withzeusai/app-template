import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

/**
 * Private app shell: a pathless layout for every signed-in page.
 *
 * - `/` stays public and server-rendered in `src/routes/index.tsx`. Never put
 *   the landing page (or anything that needs SEO / a server-rendered title)
 *   under this layout.
 * - Private pages go in `src/routes/_app/` (e.g. `_app/dashboard.tsx` serves
 *   `/dashboard`). They inherit this shell and its sign-in gate, and `_app`
 *   never appears in the URL.
 * - `ssr: false` renders these routes client-only, so loaders here run in the
 *   browser and nothing private lands in the HTML.
 * - The gate uses `useAuth().user` (the Hercules session). Use `Authenticated`
 *   from `convex/react` only around private Convex data (`useQuery` /
 *   `convexQuery`), since Convex's auth state flips only after the client
 *   WebSocket authenticates.
 */
export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Sign in to continue</h1>
            <p className="text-muted-foreground">
              This page is only available to signed-in users.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <SignInButton />
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold">
            Home
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <SignInButton variant="outline" size="sm" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
