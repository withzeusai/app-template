import { forwardRef, useCallback, useEffect } from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@usehercules/auth/react";
import { Button, buttonVariants } from "@/components/ui/button.tsx";

export interface SignInButtonProps
  extends
    Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  /**
   * Custom onClick handler that runs before authentication action
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * Whether to show icons in the button
   * @default true
   */
  showIcon?: boolean;
  /**
   * Custom text for sign in state
   * @default "Sign In"
   */
  signInText?: string;
  /**
   * Custom text for sign out state
   * @default "Sign Out"
   */
  signOutText?: string;
  /**
   * Custom text for loading state
   * @default "Signing In..." or "Signing Out..."
   */
  loadingText?: string;
  /**
   * Whether to use the asChild pattern
   * @default false
   */
  asChild?: boolean;
}

/**
 * A button component that handles authentication sign in/out with proper loading states
 * and accessibility features.
 */
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
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { isAuthenticated, signin, signout, isLoading, error } = useAuth();

    useEffect(() => {
      if (!error) return;

      // `error` covers background token renewals too, not just clicking sign
      // in. Renewals fail routinely (expired or already-rotated refresh
      // token), and the SDK now recovers by clearing the dead session, so the
      // next action is a normal sign-in. Interrupting with an error toast for
      // something the user never initiated is noise they cannot act on.
      const userInitiated = !isAuthenticated && !isLoading;
      if (!userInitiated) {
        console.warn("Background token renewal failed; signed out", error);
        return;
      }

      // Never surface `error.message` directly: for an OAuth failure it is the
      // raw `error_description` from the server (e.g. "session not found"),
      // which is server jargon rather than anything a user can act on.
      toast.error("Could not sign you in", {
        description: "Something went wrong. Please try signing in again.",
      });
      console.error("Sign-in error", error);
    }, [error, isAuthenticated, isLoading]);

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Run custom onClick first
        onClick?.(event);

        try {
          if (isAuthenticated) {
            await signout();
          } else {
            await signin();
          }
        } catch (err) {
          console.error("Authentication error:", err);
          // Don't prevent the default here as the auth library handles errors
        }
      },
      [isAuthenticated, signout, signin, onClick],
    );

    const isDisabled = disabled || isLoading;
    const defaultLoadingText = isAuthenticated
      ? "Signing Out..."
      : "Signing In...";
    const currentLoadingText = loadingText || defaultLoadingText;

    const buttonText = isLoading
      ? currentLoadingText
      : isAuthenticated
        ? signOutText
        : signInText;

    const icon = isLoading ? (
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
        asChild={asChild}
        aria-label={
          isAuthenticated
            ? "Sign out of your account"
            : "Sign in to your account"
        }
        aria-describedby={error ? "auth-error" : undefined}
        {...props}
      >
        {showIcon && icon}
        {buttonText}
      </Button>
    );
  },
);

SignInButton.displayName = "SignInButton";
