import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProvider } from "convex/react";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
  if (!CONVEX_URL) {
    // A missing URL otherwise fails silently: the app renders but every
    // Convex query hangs or errors. Fail loudly in production; in dev keep a
    // placeholder so the shell still renders without a Convex deployment.
    if (import.meta.env.PROD) {
      throw new Error(
        "VITE_CONVEX_URL is not set — the Convex client cannot connect.",
      );
    }
    console.warn(
      "VITE_CONVEX_URL is not set; Convex queries will fail until it is configured.",
    );
  }

  // ConvexQueryClient owns a ConvexReactClient and bridges Convex into
  // TanStack Query so queries can run through `convexQuery()` and SSR.
  const convexQueryClient = new ConvexQueryClient(
    CONVEX_URL ?? "http://localhost:3000",
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        // This default routes every query without its own `queryFn` through
        // Convex and THROWS for non-Convex query keys — any non-Convex
        // `useQuery` in the app must pass its own `queryFn`.
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      convexClient: convexQueryClient.convexClient,
      convexQueryClient,
    },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
