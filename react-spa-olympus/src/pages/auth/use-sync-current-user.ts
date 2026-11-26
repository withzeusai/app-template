import { useCallback } from "react";
import { useMutation } from "@usehercules/olympus/react";
import { api } from "@/backend/.olympus/api";

// The original Olympus template stores its own user record after sign-in.
export function useSyncCurrentUser() {
  const update = useMutation(api.users.updateCurrentUser);
  return useCallback(async () => {
    await update();
  }, [update]);
}
