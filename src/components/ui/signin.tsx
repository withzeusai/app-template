import { forwardRef, useCallback, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@usehercules/auth-tanstack/client";
import { Button, buttonVariants } from "@/components/ui/button.tsx";

/** Route that starts the OIDC sign-in flow (redirects to the provider). */
const SIGN_IN_PATH = "/auth/sign-in";

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
 * Renders "Sign In" or "Sign Out" from the Hercules session (`useAuth()`),
 * with loading states and accessibility attributes.
 *
 * The session is seeded during SSR, so the button is correct in the
 * server-rendered HTML. Do not wrap it in `<Unauthenticated>` /
 * `<Authenticated>` from `convex/react`: those reflect Convex's own auth
 * state, which flips only after the client WebSocket authenticates, so the
 * wrapper and the button would disagree (a "Sign Out" button inside
 * `<Unauthenticated>`). Render it unconditionally, or gate on
 * `useAuth().user` — the same source it reads.
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
    const { user, loading, signOut } = useAuth();
    const isAuthenticated = user !== null;
    const [pending, setPending] = useState(false);

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Run custom onClick first
        onClick?.(event);

        setPending(true);
        try {
          if (isAuthenticated) {
            // Clears the session and redirects to the provider's logout.
            await signOut();
          } else {
            // The sign-in route 302s to the OIDC provider; navigate to it.
            window.location.href = SIGN_IN_PATH;
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
        asChild={asChild}
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
