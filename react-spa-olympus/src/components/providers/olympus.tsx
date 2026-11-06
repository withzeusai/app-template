import { useBackendAuth } from "@usehercules/auth/react";
import { OlympusClient } from "@usehercules/olympus/client";
import { OlympusProviderWithAuth } from "@usehercules/olympus/react";

const olympusUrl = import.meta.env.VITE_OLYMPUS_URL ?? "http://127.0.0.1:3210";
// Holds every request until the auth provider has loaded and said who's signed in,
// so none runs signed out by mistake.
const client = new OlympusClient(olympusUrl, {
  db: import.meta.env.VITE_OLYMPUS_DB ?? "app",
  expectAuth: true,
});

export function OlympusProvider({ children }: { children: React.ReactNode }) {
  return (
    <OlympusProviderWithAuth client={client} useAuth={useBackendAuth}>
      {children}
    </OlympusProviderWithAuth>
  );
}
