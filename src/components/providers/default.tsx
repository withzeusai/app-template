import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { AuthProvider } from "@/components/providers/auth.tsx";
import { QueryClientProvider } from "@/components/providers/query-client.tsx";
import { UpdateCurrentUserProvider } from "@/components/providers/update-current-user.tsx";
import { ConvexProvider } from "./convex";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConvexProvider>
        <QueryClientProvider>
          <UpdateCurrentUserProvider>
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
          </UpdateCurrentUserProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </AuthProvider>
  );
}
