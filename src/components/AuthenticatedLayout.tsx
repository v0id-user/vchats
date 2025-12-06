import { ReactNode } from "react";
import { useChatConnection } from "../hooks/useChat";
import { useRequireAuth } from "../hooks/useAuth";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

/**
 * Layout wrapper for authenticated pages.
 * Manages WebSocket connection lifecycle at this level so it persists across route changes.
 */
export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const isAuthenticated = useRequireAuth();
  
  // Manage WebSocket connection at this level - persists across child route changes
  useChatConnection();

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

