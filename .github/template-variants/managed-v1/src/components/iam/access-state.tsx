import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  Clock3Icon,
  LockKeyholeIcon,
  ShieldXIcon,
  UserRoundXIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

export type IamAccessState =
  | "pending_approval"
  | "blocked"
  | "suspended"
  | "removed"
  | "missing"
  | "access_denied"
  | "permission_denied"
  | "mirror_not_ready"
  | "error";

type AccessStateContent = {
  description: string;
  icon: LucideIcon;
  title: string;
};

const ACCESS_STATE_CONTENT: Record<IamAccessState, AccessStateContent> = {
  pending_approval: {
    title: "Your access request is pending",
    description:
      "An app administrator needs to approve your request before you can continue.",
    icon: Clock3Icon,
  },
  blocked: {
    title: "Your access is blocked",
    description:
      "An app administrator has blocked this account from using the app.",
    icon: BanIcon,
  },
  suspended: {
    title: "Your access is suspended",
    description: "An app administrator has temporarily suspended your access.",
    icon: UserRoundXIcon,
  },
  removed: {
    title: "You don't have access",
    description: "Your account no longer has access to this app.",
    icon: ShieldXIcon,
  },
  missing: {
    title: "You don't have access yet",
    description: "Request access to continue to this app.",
    icon: UserRoundXIcon,
  },
  access_denied: {
    title: "You don't have access",
    description: "This account cannot access the app.",
    icon: ShieldXIcon,
  },
  permission_denied: {
    title: "You don't have access to this page",
    description:
      "Your current role does not include the permission required here.",
    icon: LockKeyholeIcon,
  },
  mirror_not_ready: {
    title: "Preparing your access",
    description:
      "Your access is still being prepared. This usually takes a moment.",
    icon: Clock3Icon,
  },
  error: {
    title: "Something went wrong",
    description: "We couldn't load this page. Please try again.",
    icon: ShieldXIcon,
  },
};

interface IamAccessStateViewProps {
  actionFailed?: boolean;
  isChecking?: boolean;
  isSigningOut?: boolean;
  onCheckAgain?: () => Promise<void> | void;
  onGoBack?: () => void;
  onRetry?: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  state: IamAccessState;
}

export function IamAccessStateView({
  actionFailed = false,
  isChecking = false,
  isSigningOut = false,
  onCheckAgain,
  onGoBack,
  onRetry,
  onSignOut,
  state,
}: IamAccessStateViewProps) {
  const content = ACCESS_STATE_CONTENT[state];
  const Icon = content.icon;
  const isBusy = isChecking || isSigningOut;
  const primaryAction =
    (state === "pending_approval" || state === "missing") && onCheckAgain
      ? {
          label: isChecking ? "Checking..." : "Check again",
          onClick: onCheckAgain,
        }
      : state === "permission_denied" && onGoBack
        ? { label: "Go back", onClick: onGoBack }
        : (state === "mirror_not_ready" || state === "error") && onRetry
          ? { label: "Try again", onClick: onRetry }
          : null;

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <Empty className="max-w-lg border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {state === "mirror_not_ready" ? (
              <Spinner className="size-6" />
            ) : (
              <Icon aria-hidden="true" />
            )}
          </EmptyMedia>
          <EmptyTitle>
            <h1>{content.title}</h1>
          </EmptyTitle>
          <EmptyDescription>{content.description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {actionFailed && (
            <p className="text-sm text-destructive" role="alert">
              We couldn't complete that action. Please try again.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant={primaryAction ? "secondary" : "default"}
              disabled={isBusy}
              onClick={() => void onSignOut()}
            >
              {isSigningOut && <Spinner />}
              <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
            </Button>
            {primaryAction && (
              <Button
                type="button"
                disabled={isBusy}
                onClick={() => void primaryAction.onClick()}
              >
                {isChecking && <Spinner />}
                <span>{primaryAction.label}</span>
              </Button>
            )}
          </div>
        </EmptyContent>
      </Empty>
    </main>
  );
}
