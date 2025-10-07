import { ConvexProviderWithAuth } from "convex/react";
import { ThemeProvider } from "next-themes";

import { convex } from "@/lib/convex.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { AuthProvider } from "@/components/providers/auth.tsx";
import { QueryClientProvider } from "@/components/providers/query-client.tsx";
import { UserStoreProvider } from "@/components/providers/user-store.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuth}>
        <QueryClientProvider>
          <UserStoreProvider>
            <TooltipProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
              >
                <Toaster />
                {children}
              </ThemeProvider>
            </TooltipProvider>
          </UserStoreProvider>
        </QueryClientProvider>
      </ConvexProviderWithAuth>
    </AuthProvider>
  );
}
