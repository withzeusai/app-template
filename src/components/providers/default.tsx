import { AuthProvider } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { UpdateCurrentUserProvider } from "./update-current-user.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConvexProvider>
        <QueryClientProvider>
          <UpdateCurrentUserProvider>
            <TooltipProvider>
              <ThemeProvider>
                <Toaster />
                {children}
              </ThemeProvider>
            </TooltipProvider>
          </UpdateCurrentUserProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </AuthProvider>
  );
}
