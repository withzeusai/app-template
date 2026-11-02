import { useFundulusAuth, useQuery } from "fundulus/react";
import { api } from "@/backend/.fundulus/api";
import { SignInButton } from "@/components/ui/signin.tsx";

// The private page the app builder is taught to write: gated on whether the
// backend has the user's token, its query running only once it does.
export default function CiE2e() {
  const { isLoading, isAuthenticated } = useFundulusAuth();
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
