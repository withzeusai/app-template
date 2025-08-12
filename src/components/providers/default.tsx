import { ConvexProvider } from "convex/react";
import { ThemeProvider } from "next-themes";

import { convex } from "@/lib/convex";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/providers/auth";
import { QueryClientProvider } from "@/components/providers/query";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <QueryClientProvider>
          <TooltipProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <Toaster />
              {children}
            </ThemeProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ConvexProvider>
  );
}
