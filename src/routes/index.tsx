import { Link, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

// Public, server-rendered landing page. Keep it outside the `_app` layout so
// its title and text are in the HTML for crawlers and signed-out visitors.
// Private pages live under `src/routes/_app/` (see `src/routes/_app.tsx`).
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // `useAuth().user` is seeded from the SSR session, so this branch is
  // correct in the server-rendered HTML with no hydration flash.
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl text-balance font-bold tracking-tight">
          Welcome to Your Blank App
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Start chatting to build your app
        </p>
        <div className="flex items-center justify-center gap-3">
          {user ? (
            <Button asChild>
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : null}
          <SignInButton variant={user ? "outline" : "default"} />
        </div>
      </div>
    </div>
  );
}
