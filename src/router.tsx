import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexAppProvider } from "@/components/providers/convex.tsx";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3000";

  // ConvexQueryClient owns a ConvexReactClient and bridges Convex into
  // TanStack Query so queries can run through `convexQuery()` and SSR.
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <ConvexAppProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexAppProvider>
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
