import { useEffect } from "react";
import { api } from "@/convex/_generated/api.js";
import { useConvexAuth, useMutation } from "convex/react";

import { useAuth } from "@/hooks/use-auth";

// This will automatically run and store the user
function useUpdateCurrentUserEffect() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useAuth();
  const sub = user?.profile.sub;
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    async function createUser() {
      await updateCurrentUser();
    }
    createUser();
  }, [isAuthenticated, updateCurrentUser, sub]);
}

// Component that automatically stores the user when authenticated
export function UpdateCurrentUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will automatically run and store the user
  useUpdateCurrentUserEffect();
  return children;
}
