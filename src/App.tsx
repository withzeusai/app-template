import { useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "react-oidc-context";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { AUTH_CONFIG } from "./hooks/use-auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

export default function App() {
  const onSigninCallback = useCallback(() => {
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);
  const onSignoutCallback = useCallback(() => {
    window.location.pathname = "";
  }, []);

  return (
    <AuthProvider
      {...AUTH_CONFIG}
      onSigninCallback={onSigninCallback}
      onSignoutCallback={onSignoutCallback}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
