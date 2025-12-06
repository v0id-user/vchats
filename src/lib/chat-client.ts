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

/** Event name to response type mapping for type-safe listeners */
export type ChatEventMap = {
  "chat.message": ChatMessageResponse;
  "typing.start": TypingStartResponse;
  "typing.stop": TypingStopResponse;
  "user.joined": UserJoinedResponse;
  "user.left": UserLeftResponse;
  "conversation.joined": ConversationJoinedResponse;
  "error": ErrorResponse;
};

export type ChatEventName = keyof ChatEventMap;

export interface ChatClientOptions {
  reconnection?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
  pingInterval?: number;
  pongTimeout?: number;
  maxQueueSize?: number;
  connectionTimeout?: number;
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
      maxQueueSize: options.maxQueueSize ?? 100,
      connectionTimeout: options.connectionTimeout ?? 10000,
    });

    // Set up internal event parsing
    this.setupEventParsing();
  }

  private setupEventParsing(): void {
    // Event to schema mapping for Zod validation
    const eventSchemas: Array<{ event: string; schema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: { issues: unknown } } }; warnOnError?: boolean }> = [
      { event: "chat.message", schema: ChatMessageSchema, warnOnError: true },
      { event: "typing.start", schema: TypingStartResponseSchema },
      { event: "typing.stop", schema: TypingStopResponseSchema },
      { event: "user.joined", schema: UserJoinedSchema },
      { event: "user.left", schema: UserLeftSchema },
      { event: "conversation.joined", schema: ConversationJoinedSchema },
      { event: "error", schema: ErrorSchema },
    ];

    for (const { event, schema, warnOnError } of eventSchemas) {
      this.client.on(event, (data: unknown) => {
        const result = schema.safeParse(data);
        if (result.success) {
          this.emit(event, result.data);
        } else if (warnOnError) {
          console.warn(`Invalid ${event} payload:`, result.error?.issues);
        }
      });
    }
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

  /**
   * Returns a promise that resolves when connected.
   * Useful for waiting until the connection is ready before sending messages.
   */
  waitForConnection(): Promise<void> {
    return this.client.waitForConnection();
  }

  /**
   * Returns detailed connection state information including
   * reconnect attempts, connection ID, and connecting status.
   */
  getConnectionState() {
    return this.client.getConnectionState();
  }

  /**
   * Read-only property indicating whether the client is currently
   * attempting to establish a connection.
   */
  get isConnecting(): boolean {
    return this.client.getConnectionState().isConnecting;
  }

  /**
   * Registers a one-time event listener on the underlying client.
   * The handler will be automatically removed after being called once.
   */
  once(event: string, callback: (data: unknown) => void): void {
    this.client.once(event, callback);
  }

  /**
   * Removes an event handler from the internal handlers map.
   */
  off(event: string, callback: (data: any) => void): void {
    this.handlers.get(event)?.delete(callback);
  }

  // ============================================
  // Type-safe event listener
  // ============================================

  /**
   * Subscribe to a chat event with type-safe callback.
   * Returns an unsubscribe function.
   */
  on<E extends ChatEventName>(event: E, callback: (data: ChatEventMap[E]) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(callback);

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

