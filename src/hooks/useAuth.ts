import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../store/auth.store";

/**
 * Hook to protect routes - redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo: string = "/login") {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: redirectTo });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  return isAuthenticated;
}

/**
 * Hook to redirect authenticated users away from auth pages
 */
export function useRedirectIfAuthenticated(redirectTo: string = "/") {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: redirectTo });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  return !isAuthenticated;
}

