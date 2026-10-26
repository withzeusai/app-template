import { Suspense } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";

// The private page the app builder is taught to write: the loader fills the
// query during SSR, the component reads it, and the session gates the page.
// `getCurrentUser` returns null for a caller without the session's token.
const currentUserQuery = convexQuery(api.users.getCurrentUser, {});

export const Route = createFileRoute("/ci-e2e-private")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(currentUserQuery),
  component: PrivatePage,
});

function PrivatePage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <a href="/auth/sign-in" data-testid="sign-in">
        Sign in
      </a>
    );
  }
  return (
    <Suspense fallback={<p>Loading</p>}>
      <CurrentUser />
    </Suspense>
  );
}

function CurrentUser() {
  const { data } = useSuspenseQuery(currentUserQuery);
  return (
    <p data-testid="current-user">
      {data === null ? "anonymous result" : data.email}
    </p>
  );
}
