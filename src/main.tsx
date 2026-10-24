import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { RootErrorBoundary } from "./components/root-error-boundary.tsx";
import { guardDomAgainstTranslation } from "./lib/translation-guard.ts";

guardDomAgainstTranslation();

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
