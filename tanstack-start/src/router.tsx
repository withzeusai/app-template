import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProvider } from "convex/react";
import RouteError from "@/components/route-error.tsx";
import { routeTree, type FileRouteTypes } from "./routeTree.gen.ts";

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
  if (!CONVEX_URL) {
    if (import.meta.env.PROD) {
      throw new Error(
        "VITE_CONVEX_URL is not set — the Convex client cannot connect.",
      );
    }
    console.warn(
      "VITE_CONVEX_URL is not set; Convex queries will fail until it is configured.",
    );
  }

  const convexQueryClient = new ConvexQueryClient(
    CONVEX_URL ?? "http://localhost:3000",
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        // Throws for non-Convex keys: other queries need their own `queryFn`.
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
    defaultErrorComponent: RouteError,
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

/** Any route path without `$params`, for typing a `<Link to>` prop. */
export type RoutePath = Exclude<FileRouteTypes["to"], `${string}$${string}`>;
