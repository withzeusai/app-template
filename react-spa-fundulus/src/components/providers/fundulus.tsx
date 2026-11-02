import { useBackendAuth } from "@usehercules/auth/react";
import { FundulusClient } from "fundulus/client";
import { FundulusProviderWithAuth } from "fundulus/react";

const fundulusUrl =
  import.meta.env.VITE_FUNDULUS_URL ?? "http://127.0.0.1:3210";
// Holds every request until the auth provider has loaded and said who's signed in,
// so none runs signed out by mistake.
const client = new FundulusClient(fundulusUrl, {
  db: import.meta.env.VITE_FUNDULUS_DB ?? "app",
  expectAuth: true,
});

export function FundulusProvider({ children }: { children: React.ReactNode }) {
  return (
    <FundulusProviderWithAuth client={client} useAuth={useBackendAuth}>
      {children}
    </FundulusProviderWithAuth>
  );
}
