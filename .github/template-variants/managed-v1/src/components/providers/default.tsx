import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";
import { HerculesIAM } from "./hercules-iam.tsx";
import { ImpersonationBanner } from "./impersonation-banner.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConvexProvider>
        <QueryClientProvider>
          <TooltipProvider>
            <ThemeProvider>
              <BrowserRouter>
                <ImpersonationBanner />
                <HerculesIAM>{children}</HerculesIAM>
                <Toaster />
              </BrowserRouter>
            </ThemeProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </AuthProvider>
  );
}
