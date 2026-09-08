import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useLocation,
} from "@tanstack/react-router";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { ConvexReactClient } from "convex/react";
import { getAuthAction, getIdTokenAction } from "@usehercules/auth-tanstack";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";
import { ConvexAppProvider } from "@/components/providers/convex.tsx";
import { ThemeProvider } from "@/components/providers/theme.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import appCss from "@/index.css?url";

const WEBSITE_ID = import.meta.env.VITE_HERCULES_WEBSITE_ID ?? "";
const OG_IMAGE = `https://hercules.app/og/app/${WEBSITE_ID}.png`;

// The root `beforeLoad` re-runs on every client-side navigation AND every
// hover preload (`defaultPreload: "intent"`), but `getAuthAction` is a server
// function — an HTTP round-trip from the browser. The session is only consumed
// once, to seed the auth provider at mount, and the provider keeps it fresh
// from there (focus/visibility revalidation), so on the client we fetch it a
// single time and reuse the promise. Sign-in and sign-out are always full-page
// redirects, so a session change can never be masked by this cache. Module
// state is safe: the client branch below is unreachable during SSR.
let clientAuthPromise: Promise<ClientUserInfo | NoUserInfo> | undefined;

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  // Read the Hercules session so authenticated Convex data can be fetched
  // during SSR. `getAuthAction` returns the sanitized session (no tokens) used
  // to seed the auth provider; the ID token only ever authenticates the
  // server-side Convex HTTP client and is never serialized to the client.
  // `serverHttpClient` is only defined during SSR.
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
    clientAuthPromise ??= getAuthAction().catch((error: unknown) => {
      // Don't cache a rejection — let the next navigation retry.
      clientAuthPromise = undefined;
      throw error;
    });
    return { auth: await clientAuthPromise };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "Hercules App" },
      { name: "description", content: "An app made by https://hercules.app" },
      { name: "author", content: "Hercules" },
      { property: "og:title", content: "Hercules App" },
      {
        property: "og:description",
        content: "An app made by https://hercules.app",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:site", content: "@usehercules" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
  shellComponent: RootDocument,
});

/**
 * Mounts the authenticated Convex + Hercules providers around the route tree.
 *
 * This renders inside `RootDocument` and within the root match, so it can read
 * the SSR session (`auth`) and the Convex client from the route context. Seeding
 * the provider with `auth` makes signed-in/out state correct in the
 * server-rendered HTML with no hydration flash.
 */
function RootComponent() {
  const { convexClient, auth } = Route.useRouteContext();
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
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          This page does not exist.
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
