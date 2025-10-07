import { useEffect } from "react";
import { api } from "@/convex/_generated/api.js";
import { useConvexAuth, useMutation } from "convex/react";

import { useAuth } from "@/hooks/use-auth";

function useStoreUserEffect() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useAuth();
  const sub = user?.profile.sub;
  const storeUser = useMutation(api.users.store);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    async function createUser() {
      await storeUser();
    }
    createUser();
  }, [isAuthenticated, storeUser, sub]);
}

// Component that automatically stores the user when authenticated
export function UserStoreProvider({ children }: { children: React.ReactNode }) {
  useStoreUserEffect(); // This will automatically run and store the user
  return children;
}
