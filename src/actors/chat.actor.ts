import { defineRoom, createActorHandler } from "verani";
import { verifyJWT } from "../lib/auth.jwt";
import { isConversationMember, getUserConversations } from "../service/conversations";
import { queueSaveMessage } from "../service/queue";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("actor:chat");

// Import Zod schemas for type-safe parsing
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

import type {
  ChatMessageResponse,
  TypingStartResponse,
  TypingStopResponse,
  UserJoinedResponse,
  UserLeftResponse,
  ConversationJoinedResponse,
  ErrorResponse,
} from "../schemas/ws/response";

// Helper to safely parse and validate request data
function parseRequest<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: any } }, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error?.issues?.[0]?.message || "Invalid request data" 
    };
  }
  return { success: true, data: result.data! };
}

// Helper to emit typed responses
function emitError(ctx: any, message: string, code?: string): void {
  const error: ErrorResponse = { message, code };
  ctx.emit.emit("error", error);
}

// Define your room with lifecycle hooks
export const chat = defineRoom({
  name: "chat",
  websocketPath: "/chat",

  // Extract user info from JWT token in query params
  async extractMeta(req) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      log.warn("extractMeta", "No token provided, anonymous connection");
      return {
        userId: "anonymous",
        clientId: crypto.randomUUID(),
        channels: ["default"],
        username: "Anonymous",
      };
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      log.warn("extractMeta", "Invalid token");
      return {
        userId: "anonymous",
        clientId: crypto.randomUUID(),
        channels: ["default"],
        username: "Anonymous",
      };
    }

    // Get user's conversations to subscribe to their channels
    const conversations = await getUserConversations(payload.sub);
    const channels = ["default", ...conversations.map((c) => `conversation:${c.id}`)];

    log.info("extractMeta", "User authenticated", { userId: payload.sub, username: payload.username, channelCount: channels.length });

    return {
      userId: payload.sub,
      clientId: crypto.randomUUID(),
      channels,
      username: payload.username,
    };
  },

  onConnect(ctx) {
    log.info("onConnect", "User connected", { userId: ctx.meta.userId, username: ctx.meta.username, clientId: ctx.meta.clientId });

    // Notify others that user joined
    const joinedEvent: UserJoinedResponse = {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
    };
    ctx.actor.emit.to("default").emit("user.joined", joinedEvent);
  },

  onDisconnect(ctx) {
    log.info("onDisconnect", "User disconnected", { userId: ctx.meta.userId, username: ctx.meta.username, clientId: ctx.meta.clientId });

    // Notify others that user left
    const leftEvent: UserLeftResponse = {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
    };
    ctx.actor.emit.to("default").emit("user.left", leftEvent);
  },
});

// Handle sending messages - uses queue for async DB write
chat.on("message.send", async (ctx, rawData: unknown) => {
  // Parse and validate request
  const parsed = parseRequest<MessageSendRequest>(MessageSendSchema, rawData);
  if (!parsed.success) {
    log.warn("message.send", "Validation failed", { userId: ctx.meta.userId, error: parsed.error });
    emitError(ctx, parsed.error, "VALIDATION_ERROR");
    return;
  }

  const { conversationId, text } = parsed.data;
  const { userId, username } = ctx.meta;

  log.info("message.send", "Message send request", { userId, username, conversationId, contentLength: text.length });

  // Verify user is member of conversation
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("message.send", "User not a member", { userId, conversationId });
    emitError(ctx, "Not a member of this conversation", "NOT_MEMBER");
    return;
  }

  // Queue message save for async write to D1
  const result = await queueSaveMessage(conversationId, userId, text);
  if (!result.success) {
    log.error("message.send", "Failed to queue message", { userId, conversationId, error: result.error });
    emitError(ctx, result.error || "Failed to save message", "SAVE_ERROR");
    return;
  }

  // Broadcast immediately - DB write happens async via queue
  const messageEvent: ChatMessageResponse = {
    id: result.messageId,
    conversationId,
    from: userId,
    fromUsername: username,
    text,
    timestamp: Date.now(),
  };
  ctx.actor.emit.to(`conversation:${conversationId}`).emit("chat.message", messageEvent);
  log.info("message.send", "Message broadcasted", { messageId: result.messageId, conversationId, userId });
});

// Handle typing indicators - start
chat.on("typing.start", async (ctx, rawData: unknown) => {
  const parsed = parseRequest<TypingStartRequest>(TypingStartSchema, rawData);
  if (!parsed.success) {
    log.warn("typing.start", "Validation failed", { userId: ctx.meta.userId, error: parsed.error });
    emitError(ctx, parsed.error, "VALIDATION_ERROR");
    return;
  }

  const { conversationId } = parsed.data;
  const { userId, username } = ctx.meta;

  // Verify user is member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.debug("typing.start", "User not a member", { userId, conversationId });
    return;
  }

  log.debug("typing.start", "Typing started", { userId, username, conversationId });

  const typingEvent: TypingStartResponse = {
    conversationId,
    userId,
    username,
  };
  ctx.actor.emit.to(`conversation:${conversationId}`).emit("typing.start", typingEvent);
});

// Handle typing indicators - stop
chat.on("typing.stop", async (ctx, rawData: unknown) => {
  const parsed = parseRequest<TypingStopRequest>(TypingStopSchema, rawData);
  if (!parsed.success) {
    emitError(ctx, parsed.error, "VALIDATION_ERROR");
    return;
  }

  const { conversationId } = parsed.data;
  const { userId, username } = ctx.meta;

  // Verify user is member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return;

  const typingEvent: TypingStopResponse = {
    conversationId,
    userId,
    username,
  };
  ctx.actor.emit.to(`conversation:${conversationId}`).emit("typing.stop", typingEvent);
});

// Handle joining a conversation channel (when starting a new conversation)
chat.on("conversation.join", async (ctx, rawData: unknown) => {
  const parsed = parseRequest<ConversationJoinRequest>(ConversationJoinSchema, rawData);
  if (!parsed.success) {
    log.warn("conversation.join", "Validation failed", { userId: ctx.meta.userId, error: parsed.error });
    emitError(ctx, parsed.error, "VALIDATION_ERROR");
    return;
  }

  const { conversationId } = parsed.data;
  const { userId } = ctx.meta;

  log.info("conversation.join", "Joining conversation", { userId, conversationId });

  // Verify user is member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("conversation.join", "User not a member", { userId, conversationId });
    emitError(ctx, "Not a member of this conversation", "NOT_MEMBER");
    return;
  }

  // Add channel to user's subscriptions
  const channel = `conversation:${conversationId}`;
  if (!ctx.meta.channels.includes(channel)) {
    ctx.meta.channels.push(channel);
    log.info("conversation.join", "Channel added to subscriptions", { userId, conversationId, channel });
  }

  const joinedEvent: ConversationJoinedResponse = { conversationId };
  ctx.emit.emit("conversation.joined", joinedEvent);
});

// Create the Durable Object class
export const Chat = createActorHandler(chat);
