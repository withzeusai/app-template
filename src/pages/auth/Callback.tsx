import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth.ts";
import { Spinner } from "@/components/ui/spinner.tsx";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, error } = useAuth();

  useEffect(() => {
    // If authentication is complete and successful, redirect to home
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
    // If there's an error, we could redirect to an error page or home
    // For now, we'll redirect to home and let the app handle the error state
    else if (!isLoading && error) {
      console.error("Authentication error:", error);
      navigate("/", { replace: true });
    }
  }, [isLoading, isAuthenticated, error, navigate]);

  // Show loading spinner while authentication is in progress
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner className="mx-auto" />
    </div>
  );
}
