import { forwardRef, useCallback, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { useAuth } from "@/hooks/use-auth.ts";

/** Route that starts the OIDC sign-in flow (redirects to the provider). */
const SIGN_IN_PATH = "/auth/sign-in";

export type SignInButtonProps = Omit<
  React.ComponentProps<"button">,
  "onClick"
> &
  VariantProps<typeof buttonVariants> & {
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    showIcon?: boolean;
    signInText?: string;
    signOutText?: string;
    loadingText?: string;
  };

/** Renders Sign In / Sign Out from the Hercules session (`useAuth()`); do not wrap in `<Unauthenticated>` / `<Authenticated>` from `convex/react`. */
export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Sign In",
      signOutText = "Sign Out",
      loadingText,
      className,
      variant,
      size,
      ...props
    },
    ref,
  ) => {
    const { user, loading, signOut } = useAuth();
    const isAuthenticated = user !== null;
    const [pending, setPending] = useState(false);

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);

        setPending(true);
        try {
          if (isAuthenticated) {
            await signOut();
          } else {
            const { pathname, search, hash } = window.location;
            const returnTo = encodeURIComponent(`${pathname}${search}${hash}`);
            window.location.href = `${SIGN_IN_PATH}?returnTo=${returnTo}`;
            return;
          }
        } catch (err) {
          console.error("Authentication error:", err);
          toast.error("Authentication error", {
            description: err instanceof Error ? err.message : String(err),
          });
        } finally {
          setPending(false);
        }
      },
      [isAuthenticated, signOut, onClick],
    );

    const isBusy = loading || pending;
    const isDisabled = disabled || isBusy;
    const defaultLoadingText = isAuthenticated
      ? "Signing Out..."
      : "Signing In...";
    const currentLoadingText = loadingText || defaultLoadingText;

    const buttonText = isBusy
      ? currentLoadingText
      : isAuthenticated
        ? signOutText
        : signInText;

    const icon = isBusy ? (
      <Loader2 className="size-4 animate-spin" />
    ) : isAuthenticated ? (
      <LogOut className="size-4" />
    ) : (
      <LogIn className="size-4" />
    );

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        variant={variant}
        size={size}
        className={className}
        aria-label={
          isAuthenticated
            ? "Sign out of your account"
            : "Sign in to your account"
        }
        {...props}
      >
        {showIcon && icon}
        {buttonText}
      </Button>
    );
  },
);

SignInButton.displayName = "SignInButton";
