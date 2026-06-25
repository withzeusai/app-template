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

const AUTH_ACCESS_PATHS = [
  ["pending_approval", "pending-approval"],
  ["blocked", "blocked"],
  ["suspended", "suspended"],
  ["removed", "removed"],
  ["missing", "missing"],
  ["access_denied", "access-denied"],
] as const satisfies ReadonlyArray<readonly [AuthAccessState, string]>;

export function getAuthAccessRoute(status: string | undefined): string {
  const path = AUTH_ACCESS_PATHS.find(([state]) => state === status)?.[1];

  return `/auth/${path ?? "access-denied"}`;
}

export function getAuthAccessState(
  path: string | undefined,
): AuthAccessState | null {
  return AUTH_ACCESS_PATHS.find(([, route]) => route === path)?.[0] ?? null;
}
