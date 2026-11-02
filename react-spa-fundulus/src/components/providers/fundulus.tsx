import { useBackendAuth } from "@usehercules/auth/react";
import { FundulusClient } from "fundulus/client";
import { FundulusProviderWithAuth } from "fundulus/react";

const fundulusUrl =
  import.meta.env.VITE_FUNDULUS_URL ?? "http://127.0.0.1:3210";
const client = new FundulusClient(fundulusUrl, {
  db: import.meta.env.VITE_FUNDULUS_DB ?? "app",
});

export function FundulusProvider({ children }: { children: React.ReactNode }) {
  return (
    <FundulusProviderWithAuth client={client} useAuth={useBackendAuth}>
      {children}
    </FundulusProviderWithAuth>
  );
}
