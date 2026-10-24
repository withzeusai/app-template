import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { ConvexReactClient } from "convex/react";
import { getAuthAction, getIdTokenAction } from "@usehercules/auth-tanstack";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";
import ConvexAppProvider from "@/components/providers/convex.tsx";
import ThemeProvider from "@/components/providers/theme.tsx";
import RouteError from "@/components/route-error.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { useAuthErrorToast } from "@/hooks/use-auth-error-toast.ts";
import { site } from "@/lib/site.ts";
import appCss from "@/index.css?url";

// On the client, reuse one session snapshot across navigations and hover
// preloads (`getAuthAction` is an HTTP round trip), and refetch it once it is
// older than `CLIENT_AUTH_TTL_MS` or the tab was hidden, so a sign-out in
// another tab or an expired session is picked up. Sign-in and sign-out here
// are full-page redirects. Convex checks the session on every call; this only
// decides what to render.
const CLIENT_AUTH_TTL_MS = 60_000;

let clientAuth:
  | { promise: Promise<ClientUserInfo | NoUserInfo>; fetchedAt: number }
  | undefined;
let clearsOnHide = false;

function getClientAuth(): Promise<ClientUserInfo | NoUserInfo> {
  if (!clearsOnHide) {
    clearsOnHide = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") clientAuth = undefined;
    });
  }
  const now = Date.now();
  if (
    clientAuth === undefined ||
    now - clientAuth.fetchedAt > CLIENT_AUTH_TTL_MS
  ) {
    const promise = getAuthAction().catch((error: unknown) => {
      // Don't cache a rejection: let the next navigation retry.
      if (clientAuth?.promise === promise) clientAuth = undefined;
      throw error;
    });
    clientAuth = { promise, fetchedAt: now };
  }
  return clientAuth.promise;
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  // During SSR the ID token authenticates the server Convex client; only the
  // sanitized session reaches the browser.
  beforeLoad: async (ctx) => {
    const serverHttpClient = ctx.context.convexQueryClient.serverHttpClient;
    if (serverHttpClient) {
      const [auth, idToken] = await Promise.all([
        getAuthAction(),
        getIdTokenAction(),
      ]);
      if (idToken) {
        serverHttpClient.setAuth(idToken);
      }
      return { auth };
    }
    return { auth: await getClientAuth() };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: site.name },
      { name: "description", content: site.tagline },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  errorComponent: RootRouteError,
  notFoundComponent: NotFound,
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  const { convexClient, auth } = Route.useRouteContext();
  useAuthErrorToast(auth.user !== null);
  return (
    <ConvexAppProvider client={convexClient} initialAuth={auth}>
      <Outlet />
    </ConvexAppProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            {children}
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootRouteError(props: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <RouteError {...props} />
    </div>
  );
}

function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <meta name="robots" content="noindex" />
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          This page does not exist.
        </p>
        <div className="pt-4">
          <Link to="/" className={buttonVariants()}>
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
