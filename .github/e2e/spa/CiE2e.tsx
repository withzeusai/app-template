import { useOlympusAuth, useQuery } from "@usehercules/olympus/react";
import { api } from "@/backend/.olympus/api";
import { SignInButton } from "@/components/ui/signin.tsx";

// The private page the app builder is taught to write: gated on whether the
// backend has the user's token, its query running only once it does.
export default function CiE2e() {
  const { isLoading, isAuthenticated } = useOlympusAuth();
  if (isLoading) return <p>Loading</p>;
  if (!isAuthenticated) return <SignInButton data-testid="sign-in" />;
  return (
    <>
      <CurrentUser />
      <SignInButton data-testid="sign-out" />
    </>
  );
}

function CurrentUser() {
  const user = useQuery(api.users.getCurrentUser);
  return (
    <p data-testid="current-user">
      {user === undefined ? "loading" : (user?.email ?? "no row")}
    </p>
  );
}
