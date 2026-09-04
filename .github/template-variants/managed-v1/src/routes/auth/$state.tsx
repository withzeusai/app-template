import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  IamAccessRoute,
  isAuthAccessPath,
} from "@/components/providers/hercules-iam.tsx";

/**
 * The Hercules IAM access-state pages: /auth/pending-approval, /auth/blocked,
 * /auth/suspended, /auth/removed, /auth/missing, /auth/access-denied. The
 * HerculesIAM provider navigates here when deployment entry or a Convex
 * function denies access. Managed by Hercules IAM; do not edit. The static
 * /auth/sign-in and /auth/callback server routes take precedence over this
 * dynamic segment, and any other value is a 404.
 */
export const Route = createFileRoute("/auth/$state")({
  beforeLoad: ({ params }) => {
    if (!isAuthAccessPath(params.state)) {
      throw notFound();
    }
  },
  component: AuthAccessPage,
});

function AuthAccessPage() {
  const { state } = Route.useParams();
  return <IamAccessRoute path={state} />;
}
