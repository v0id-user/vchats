import { useEffect, useRef, useEffectEvent } from "react";
import { useAuthStore } from "../store/auth.store";
import { useChatStore } from "../store/chat.store";
import { useFriendsStore } from "../store/friends.store";

/**
 * Hook to manage WebSocket connection lifecycle.
 * Called in AuthenticatedLayout - disconnect is handled by useLogout, not unmount.
 */
export function useChatConnection() {
  const { isAuthenticated, token } = useAuthStore();
  const { client, connect, disconnect, fetchConversations } = useChatStore();
  const { fetchFriends, fetchIncomingRequests, fetchOutgoingRequests } = useFriendsStore();
  const hasConnectedRef = useRef(false);

  // Effect Event for initial connection and data fetch - non-reactive, always reads latest
  // Now awaits connection before fetching data to ensure proper sequencing
  const onConnect = useEffectEvent(async () => {
    await connect();
    // Fetch initial data after connection is established
    fetchConversations();
    fetchFriends();
    fetchIncomingRequests();
    fetchOutgoingRequests();
  });

  // Effect Event for cleanup - non-reactive
  const onDisconnect = useEffectEvent(() => {
    disconnect();
  });

  useEffect(() => {
    // Only connect if authenticated and no existing connection
    if (isAuthenticated && token && !client && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      onConnect();
    }

    // Disconnect when logged out
    if (!isAuthenticated && hasConnectedRef.current) {
      onDisconnect();
      hasConnectedRef.current = false;
    }
  }, [isAuthenticated, token, client, onConnect, onDisconnect]);

  // NOTE: No unmount cleanup here - logout handles disconnection via resetChat()
  // This prevents reconnect loops when navigating between authenticated routes

  return { isConnected: !!client };
}

/**
 * Hook to handle logout and cleanup
 */
export function useLogout() {
  const { logout: authLogout } = useAuthStore();
  const { reset: resetChat } = useChatStore();
  const { reset: resetFriends } = useFriendsStore();

  const logout = useEffectEvent(() => {
    resetChat(); // This disconnects and clears chat state
    resetFriends();
    authLogout();
  });

  return logout;
}

/**
 * Hook to refresh data when needed (e.g., after accepting friend request)
 */
export function useRefreshData() {
  const { fetchConversations } = useChatStore();
  const { fetchFriends, fetchIncomingRequests, fetchOutgoingRequests } = useFriendsStore();

  const refreshAll = useEffectEvent(async () => {
    await Promise.all([
      fetchConversations(),
      fetchFriends(),
      fetchIncomingRequests(),
      fetchOutgoingRequests(),
    ]);
  });

  const refreshFriends = useEffectEvent(async () => {
    await Promise.all([
      fetchFriends(),
      fetchIncomingRequests(),
      fetchOutgoingRequests(),
    ]);
  });

  const refreshConversations = useEffectEvent(async () => {
    await fetchConversations();
  });

  return { refreshAll, refreshFriends, refreshConversations };
}
