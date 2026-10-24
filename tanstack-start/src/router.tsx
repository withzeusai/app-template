import { ConvexQueryClient } from "@convex-dev/react-query";
import {
  QueryClient,
  hashKey,
  type QueryFunctionContext,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProvider } from "convex/react";
import RouteError from "@/components/route-error.tsx";
import { routeTree, type FileRouteTypes } from "./routeTree.gen.ts";

/**
 * The default `queryFn` for a query that is neither a Convex query nor a
 * Convex action. Data from outside Convex needs its own `queryFn`.
 */
function missingQueryFn({ queryKey }: QueryFunctionContext): never {
  throw new Error(
    `Query ${hashKey(queryKey)} has no queryFn. Pass a queryFn to useQuery() or queryOptions() for data from outside Convex, and use convexQuery() from @convex-dev/react-query for Convex queries.`,
  );
}

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
        // Convex query and action keys go through Convex; any other key
        // without its own `queryFn` fails with `missingQueryFn`'s message.
        queryFn: convexQueryClient.queryFn(missingQueryFn),
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
