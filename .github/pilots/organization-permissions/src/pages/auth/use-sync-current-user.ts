import { useCallback } from "react";
import { useOlympus } from "@usehercules/olympus/react";
import { api } from "@/backend/.olympus/api";

// Hercules provisions the user before sign-in completes.
export function useSyncCurrentUser() {
  const client = useOlympus();
  return useCallback(async () => {
    if (!(await client.query(api.directory.viewer))) {
      throw new Error("Your Hercules account is unavailable.");
    }
  }, [client]);
}
