import { create } from "zustand";
import { useAuthStore } from "./auth.store";
import {
  getFriends as getFriendsFn,
  getIncomingRequests as getIncomingFn,
  getOutgoingRequests as getOutgoingFn,
  sendFriendRequest as sendRequestFn,
  acceptFriendRequest as acceptFn,
  rejectFriendRequest as rejectFn,
} from "../server/friends";

export interface Friend {
  id: string;
  username: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

interface FriendsState {
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  loading: boolean;

  // Actions
  fetchFriends: () => Promise<void>;
  fetchIncomingRequests: () => Promise<void>;
  fetchOutgoingRequests: () => Promise<void>;
  sendRequest: (toUserId: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  rejectRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  reset: () => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  loading: false,

  fetchFriends: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ loading: true });
    try {
      const result = await getFriendsFn({ data: { token } });
      if (result.friends) {
        set({ friends: result.friends });
      }
    } finally {
      set({ loading: false });
    }
  },

  fetchIncomingRequests: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const result = await getIncomingFn({ data: { token } });
    if (result.requests) {
      set({ incomingRequests: result.requests });
    }
  },

  fetchOutgoingRequests: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const result = await getOutgoingFn({ data: { token } });
    if (result.requests) {
      set({ outgoingRequests: result.requests });
    }
  },

  sendRequest: async (toUserId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: "Not authenticated" };

    const result = await sendRequestFn({ data: { toUserId, token } });
    if (result.success) {
      get().fetchOutgoingRequests();
    }
    return result;
  },

  acceptRequest: async (requestId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: "Not authenticated" };

    const result = await acceptFn({ data: { requestId, token } });
    if (result.success) {
      get().fetchIncomingRequests();
      get().fetchFriends();
    }
    return result;
  },

  rejectRequest: async (requestId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: "Not authenticated" };

    const result = await rejectFn({ data: { requestId, token } });
    if (result.success) {
      get().fetchIncomingRequests();
    }
    return result;
  },

  reset: () => set({ friends: [], incomingRequests: [], outgoingRequests: [], loading: false }),
}));
