import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const RELOAD_GUARD_KEY = "hercules:chunk-reload-at";
const RELOAD_GUARD_WINDOW_MS = 30_000;

// Publishing rotates every hashed filename under /assets, so a tab opened
// before a publish fails its next lazy-route import and renders nothing until
// the user reloads. sessionStorage bounds this to one reload per tab per
// window, so a chunk that is genuinely absent surfaces as the import error
// rather than a reload loop.
//
// No preventDefault: Vite only rethrows when the event is not defaultPrevented,
// and suppressing it resolves the failed import to `undefined`, which the
// router then dereferences into a TypeError before the reload commits.
window.addEventListener("vite:preloadError", () => {
  try {
    const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - lastReload < RELOAD_GUARD_WINDOW_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
