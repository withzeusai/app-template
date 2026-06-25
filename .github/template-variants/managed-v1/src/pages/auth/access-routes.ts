import type { IamAccessState } from "@/components/iam/access-state.tsx";

export type AuthAccessState = Extract<
  IamAccessState,
  | "pending_approval"
  | "blocked"
  | "suspended"
  | "removed"
  | "missing"
  | "access_denied"
>;

const AUTH_ACCESS_ROUTES: Record<AuthAccessState, string> = {
  pending_approval: "/auth/pending-approval",
  blocked: "/auth/blocked",
  suspended: "/auth/suspended",
  removed: "/auth/removed",
  missing: "/auth/missing",
  access_denied: "/auth/access-denied",
};

export function getAuthAccessRoute(status: string | undefined): string {
  switch (status) {
    case "pending_approval":
    case "blocked":
    case "suspended":
    case "removed":
    case "missing":
    case "access_denied":
      return AUTH_ACCESS_ROUTES[status];
    default:
      return AUTH_ACCESS_ROUTES.access_denied;
  }
}
