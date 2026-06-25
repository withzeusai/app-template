import { Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AuthAccessStatus } from "./pages/auth/AccessStatus.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/*" element={<AuthAccessStatus />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DefaultProviders>
  );
}
