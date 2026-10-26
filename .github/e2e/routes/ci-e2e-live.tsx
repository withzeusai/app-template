import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api.js";

// A query that only runs in the browser, after hydration: it answers only once
// the Convex client is allowed to send requests, so it shows whether a
// signed-out visitor's client was released.
const currentUserQuery = convexQuery(api.users.getCurrentUser, {});

export const Route = createFileRoute("/ci-e2e-live")({
  component: LivePage,
});

function LivePage() {
  const { data, isPending } = useQuery(currentUserQuery);
  let text = "pending";
  if (!isPending) text = data === null ? "anonymous result" : data.email;
  return <p data-testid="live-user">{text}</p>;
}
