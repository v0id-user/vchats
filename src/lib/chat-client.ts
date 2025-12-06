import { VeraniClient } from "verani/client";

// Import request schemas and types
import {
  MessageSendSchema,
  TypingStartSchema,
  TypingStopSchema,
  ConversationJoinSchema,
  type MessageSendRequest,
  type TypingStartRequest,
  type TypingStopRequest,
  type ConversationJoinRequest,
} from "../schemas/ws/request";

// Import response schemas and types
import {
  ChatMessageSchema,
  TypingStartResponseSchema,
  TypingStopResponseSchema,
  UserJoinedSchema,
  UserLeftSchema,
  ConversationJoinedSchema,
  ErrorSchema,
  type ChatMessageResponse,
  type TypingStartResponse,
  type TypingStopResponse,
  type UserJoinedResponse,
  type UserLeftResponse,
  type ConversationJoinedResponse,
  type ErrorResponse,
} from "../schemas/ws/response";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting" | "error";

export interface ChatClientOptions {
  reconnection?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
  pingInterval?: number;
  pongTimeout?: number;
}

/**
 * Type-safe WebSocket client wrapper for chat functionality.
 * Uses Zod schemas for validating incoming/outgoing messages.
 */
export class ChatClient {
  private client: VeraniClient;
  private handlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor(url: string, options: ChatClientOptions = {}) {
    this.client = new VeraniClient(url, {
      reconnection: {
        enabled: options.reconnection?.enabled ?? true,
        maxAttempts: options.reconnection?.maxAttempts ?? 10,
        initialDelay: options.reconnection?.initialDelay ?? 1000,
        maxDelay: options.reconnection?.maxDelay ?? 30000,
        backoffMultiplier: 1.5,
      },
      pingInterval: options.pingInterval ?? 5000,
      pongTimeout: options.pongTimeout ?? 5000,
    });

    // Set up internal event parsing
    this.setupEventParsing();
  }

  private setupEventParsing(): void {
    // Parse and validate incoming chat messages
    this.client.on("chat.message", (data: unknown) => {
      const result = ChatMessageSchema.safeParse(data);
      if (result.success) {
        this.emit("chat.message", result.data);
      } else {
        console.warn("Invalid chat.message payload:", result.error.issues);
      }
    });

    // Parse typing.start events
    this.client.on("typing.start", (data: unknown) => {
      const result = TypingStartResponseSchema.safeParse(data);
      if (result.success) {
        this.emit("typing.start", result.data);
      }
    });

    // Parse typing.stop events
    this.client.on("typing.stop", (data: unknown) => {
      const result = TypingStopResponseSchema.safeParse(data);
      if (result.success) {
        this.emit("typing.stop", result.data);
      }
    });

    // Parse user.joined events
    this.client.on("user.joined", (data: unknown) => {
      const result = UserJoinedSchema.safeParse(data);
      if (result.success) {
        this.emit("user.joined", result.data);
      }
    });

    // Parse user.left events
    this.client.on("user.left", (data: unknown) => {
      const result = UserLeftSchema.safeParse(data);
      if (result.success) {
        this.emit("user.left", result.data);
      }
    });

    // Parse conversation.joined events
    this.client.on("conversation.joined", (data: unknown) => {
      const result = ConversationJoinedSchema.safeParse(data);
      if (result.success) {
        this.emit("conversation.joined", result.data);
      }
    });

    // Parse error events
    this.client.on("error", (data: unknown) => {
      const result = ErrorSchema.safeParse(data);
      if (result.success) {
        this.emit("error", result.data);
      }
    });
  }

  // Internal emit to handlers
  private emit(event: string, data: any): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(data));
    }
  }

  // ============================================
  // Connection lifecycle methods
  // ============================================

  onOpen(callback: () => void): void {
    this.client.onOpen(callback);
  }

  onClose(callback: (event: CloseEvent) => void): void {
    this.client.onClose(callback);
  }

  onStateChange(callback: (state: ConnectionState) => void): void {
    this.client.onStateChange(callback);
  }

  onError(callback: (error: Event) => void): void {
    this.client.onError(callback);
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  getState(): ConnectionState {
    return this.client.getState();
  }

  disconnect(): void {
    this.client.disconnect();
  }

  close(): void {
    this.client.close();
    this.handlers.clear();
  }

  reconnect(): void {
    this.client.reconnect();
  }

  // ============================================
  // Type-safe event listeners
  // ============================================

  onMessage(callback: (data: ChatMessageResponse) => void): () => void {
    return this.addHandler("chat.message", callback);
  }

  onTypingStart(callback: (data: TypingStartResponse) => void): () => void {
    return this.addHandler("typing.start", callback);
  }

  onTypingStop(callback: (data: TypingStopResponse) => void): () => void {
    return this.addHandler("typing.stop", callback);
  }

  onUserJoined(callback: (data: UserJoinedResponse) => void): () => void {
    return this.addHandler("user.joined", callback);
  }

  onUserLeft(callback: (data: UserLeftResponse) => void): () => void {
    return this.addHandler("user.left", callback);
  }

  onConversationJoined(callback: (data: ConversationJoinedResponse) => void): () => void {
    return this.addHandler("conversation.joined", callback);
  }

  onChatError(callback: (data: ErrorResponse) => void): () => void {
    return this.addHandler("error", callback);
  }

  private addHandler(event: string, callback: (data: any) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(callback);
    };
  }

  // ============================================
  // Type-safe emit methods
  // ============================================

  sendMessage(data: MessageSendRequest): void {
    const result = MessageSendSchema.safeParse(data);
    if (!result.success) {
      console.error("Invalid message.send payload:", result.error.issues);
      return;
    }
    this.client.emit("message.send", result.data);
  }

  startTyping(data: TypingStartRequest): void {
    const result = TypingStartSchema.safeParse(data);
    if (!result.success) {
      console.error("Invalid typing.start payload:", result.error.issues);
      return;
    }
    this.client.emit("typing.start", result.data);
  }

  stopTyping(data: TypingStopRequest): void {
    const result = TypingStopSchema.safeParse(data);
    if (!result.success) {
      console.error("Invalid typing.stop payload:", result.error.issues);
      return;
    }
    this.client.emit("typing.stop", result.data);
  }

  joinConversation(data: ConversationJoinRequest): void {
    const result = ConversationJoinSchema.safeParse(data);
    if (!result.success) {
      console.error("Invalid conversation.join payload:", result.error.issues);
      return;
    }
    this.client.emit("conversation.join", result.data);
  }
}

// Factory function for convenience
export function createChatClient(url: string, options?: ChatClientOptions): ChatClient {
  return new ChatClient(url, options);
}

