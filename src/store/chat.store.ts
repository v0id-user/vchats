import { create } from "zustand";
import { useAuthStore } from "./auth.store";
import { ChatClient, createChatClient } from "../lib/chat-client";
import {
  getConversations as getConversationsFn,
  getMessages as getMessagesFn,
  createDirectConversation as createDirectFn,
  createGroupConversation as createGroupFn,
} from "../server/conversations";

export interface ConversationMember {
  id: string;
  username: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  members: ConversationMember[];
  lastMessage?: {
    content: string;
    createdAt: Date;
    senderUsername: string;
  };
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: Date;
}

interface TypingUser {
  id: string;
  username: string;
}

interface ChatState {
  // WebSocket
  client: ChatClient | null;
  connected: boolean;

  // Conversations
  conversations: Conversation[];
  activeConversation: Conversation | null;

  // Messages
  messages: Message[];

  // Typing indicators
  typingUsers: TypingUser[];

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  fetchConversations: () => Promise<void>;
  setActiveConversation: (conversation: Conversation | null) => void;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  createDirectConversation: (userId: string) => Promise<{ success: boolean; conversation?: Conversation; error?: string }>;
  createGroupConversation: (name: string, memberIds: string[]) => Promise<{ success: boolean; conversation?: Conversation; error?: string }>;
  addMessage: (message: Message) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  client: null,
  connected: false,
  conversations: [],
  activeConversation: null,
  messages: [],
  typingUsers: [],

  connect: async () => {
    const { token, user } = useAuthStore.getState();
    if (!token || !user || get().client) return;

    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/chat?token=${token}`;

    // Create typed chat client with correct Verani API
    const client = createChatClient(wsUrl, {
      reconnection: {
        enabled: true,
        maxAttempts: 10,
      },
      pingInterval: 60000,
      connectionTimeout: 10000,
      maxQueueSize: 100,
    });

    // Connection lifecycle handlers (correct Verani API)
    client.onClose(() => {
      set({ connected: false });
    });

    client.onStateChange((state) => {
      set({ connected: state === "connected" });
    });

    // Type-safe event handlers with Zod-validated data
    client.on("chat.message", (data) => {
      const { activeConversation, conversations } = get();

      const message: Message = {
        id: data.id,
        conversationId: data.conversationId,
        senderId: data.from,
        senderUsername: data.fromUsername,
        content: data.text,
        createdAt: new Date(data.timestamp),
      };

      // If message is for active conversation, add to messages
      if (activeConversation?.id === data.conversationId) {
        set({ messages: [...get().messages, message] });
      }

      // Update last message in conversations list
      set({
        conversations: conversations.map((c) =>
          c.id === data.conversationId
            ? {
                ...c,
                lastMessage: {
                  content: data.text,
                  createdAt: message.createdAt,
                  senderUsername: message.senderUsername,
                },
              }
            : c
        ),
      });
    });

    // Typing indicators with type-safe data
    client.on("typing.start", (data) => {
      const { typingUsers, activeConversation } = get();
      if (data.conversationId !== activeConversation?.id) return;
      if (data.userId === user.id) return;

      if (!typingUsers.find((u) => u.id === data.userId)) {
        set({ typingUsers: [...typingUsers, { id: data.userId, username: data.username }] });
      }
    });

    client.on("typing.stop", (data) => {
      set({
        typingUsers: get().typingUsers.filter((u) => u.id !== data.userId),
      });
    });

    // User presence
    client.on("user.joined", (data) => {
      console.log("User joined:", data.username, data.userId);
    });

    client.on("user.left", (data) => {
      // Remove from typing
      set({
        typingUsers: get().typingUsers.filter((u) => u.id !== data.userId),
      });
    });

    // Error handling
    client.on("error", (data) => {
      console.error("Chat error:", data.message, data.code);
    });

    // Store client
    set({ client });

    // Wait for connection to be established before marking as connected
    try {
      await client.waitForConnection();
      set({ connected: true });
    } catch (error) {
      console.error("Failed to establish WebSocket connection:", error);
      // Client is stored but not connected - reconnection will be attempted automatically
    }
  },

  disconnect: () => {
    const { client } = get();
    if (client) {
      client.disconnect();
      set({ client: null, connected: false });
    }
  },

  fetchConversations: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const result = await getConversationsFn({ data: { token } });
    if (result.conversations) {
      set({ conversations: result.conversations });
    }
  },

  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation, messages: [], typingUsers: [] });
    if (conversation) {
      get().fetchMessages(conversation.id);

      // Join conversation channel via typed method
      const { client } = get();
      if (client) {
        client.joinConversation({ conversationId: conversation.id });
      }
    }
  },

  fetchMessages: async (conversationId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const result = await getMessagesFn({ data: { conversationId, token } });
    if (result.success && result.messages) {
      set({ messages: result.messages });
    }
  },

  sendMessage: (content) => {
    const { client, activeConversation, connected } = get();

    if (!client || !activeConversation || !connected) return;

    // Type-safe emit
    client.sendMessage({
      conversationId: activeConversation.id,
      text: content,
    });
  },

  startTyping: () => {
    const { client, activeConversation, connected } = get();
    if (!client || !activeConversation || !connected) return;

    // Type-safe emit
    client.startTyping({
      conversationId: activeConversation.id,
    });
  },

  stopTyping: () => {
    const { client, activeConversation, connected } = get();
    if (!client || !activeConversation || !connected) return;

    // Type-safe emit
    client.stopTyping({
      conversationId: activeConversation.id,
    });
  },

  createDirectConversation: async (userId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: "Not authenticated" };

    const result = await createDirectFn({ data: { userId, token } });
    if (result.success && result.conversation) {
      await get().fetchConversations();
      get().setActiveConversation(result.conversation);
    }
    return result as any;
  },

  createGroupConversation: async (name, memberIds) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: "Not authenticated" };

    const result = await createGroupFn({ data: { name, memberIds, token } });
    if (result.success && result.conversation) {
      await get().fetchConversations();
      get().setActiveConversation(result.conversation);
    }
    return result as any;
  },

  addMessage: (message) => {
    set({ messages: [...get().messages, message] });
  },

  reset: () => {
    get().disconnect();
    set({
      client: null,
      connected: false,
      conversations: [],
      activeConversation: null,
      messages: [],
      typingUsers: [],
    });
  },
}));
