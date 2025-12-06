import { createTypedRoom, createActorHandler } from "verani/typed";
import { verifyJWT } from "../lib/auth.jwt";
import { isConversationMember, getUserConversations } from "../service/conversations";
import { saveMessage } from "../service/messages";
import { createScopedLogger } from "../lib/logger";
import { chatContract } from "../contracts/chat.contract";

const log = createScopedLogger("actor:chat");

// Define connection metadata type
interface ChatMeta {
  userId: string;
  clientId: string;
  channels: string[];
  username: string;
}

// Create typed room with contract
const chat = createTypedRoom(chatContract, {
  name: "chat",
  websocketPath: "/chat",

  // Extract user info from JWT token in query params
  async extractMeta(req): Promise<ChatMeta> {
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

    log.info("extractMeta", "User authenticated", {
      userId: payload.sub,
      username: payload.username,
      channelCount: channels.length,
    });

    return {
      userId: payload.sub,
      clientId: crypto.randomUUID(),
      channels,
      username: payload.username,
    };
  },

  onConnect(ctx) {
    log.info("onConnect", "User connected", {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
      clientId: ctx.meta.clientId,
    });

    // Notify others that user joined
    ctx.actor.emit.to("default").emit("user.joined", {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
    });
  },

  onDisconnect(ctx) {
    log.info("onDisconnect", "User disconnected", {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
      clientId: ctx.meta.clientId,
    });

    // Notify others that user left
    ctx.actor.emit.to("default").emit("user.left", {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
    });
  },
});

// Handle sending messages - typed data comes directly from contract
chat.handle("message.send", async (ctx, data) => {
  const { conversationId, text } = data;
  const { userId, username } = ctx.meta;

  log.info("message.send", "Message send request", {
    userId,
    username,
    conversationId,
    contentLength: text.length,
  });

  // Verify user is member of conversation
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("message.send", "User not a member", { userId, conversationId });
    ctx.emit("error", { message: "Not a member of this conversation", code: "NOT_MEMBER" });
    return;
  }

  // Save message to D1 synchronously before broadcasting
  const result = await saveMessage(conversationId, userId, text);
  if (!result.success || !result.message) {
    log.error("message.send", "Failed to save message", {
      userId,
      conversationId,
      error: result.error,
    });
    ctx.emit("error", { message: result.error || "Failed to save message", code: "SAVE_ERROR" });
    return;
  }

  // Broadcast after successful DB write
  ctx.actor.emit.to(`conversation:${conversationId}`).emit("chat.message", {
    id: result.message.id,
    conversationId,
    from: userId,
    fromUsername: username,
    text,
    timestamp: result.message.createdAt.getTime(),
  });

  log.info("message.send", "Message saved and broadcasted", {
    messageId: result.message.id,
    conversationId,
    userId,
  });
});

// Handle typing indicators - start
chat.handle("typing.start", async (ctx, data) => {
  const { conversationId } = data;
  const { userId, username } = ctx.meta;

  // Verify user is member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.debug("typing.start", "User not a member", { userId, conversationId });
    return;
  }

  log.debug("typing.start", "Typing started", { userId, username, conversationId });

  ctx.actor.emit.to(`conversation:${conversationId}`).emit("typing.start", {
    conversationId,
    userId,
    username,
  });
});

// Handle typing indicators - stop
chat.handle("typing.stop", async (ctx, data) => {
  const { conversationId } = data;
  const { userId, username } = ctx.meta;

  // Verify user is member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return;

  ctx.actor.emit.to(`conversation:${conversationId}`).emit("typing.stop", {
    conversationId,
    userId,
    username,
  });
});

// Handle joining a conversation channel (when starting a new conversation)
chat.handle("conversation.join", async (ctx, data) => {
  const { conversationId } = data;
  const { userId } = ctx.meta;

  log.info("conversation.join", "Joining conversation", { userId, conversationId });

  // Verify user is member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("conversation.join", "User not a member", { userId, conversationId });
    ctx.emit("error", { message: "Not a member of this conversation", code: "NOT_MEMBER" });
    return;
  }

  // Add channel to user's subscriptions
  const channel = `conversation:${conversationId}`;
  if (!ctx.meta.channels.includes(channel)) {
    ctx.meta.channels.push(channel);
    log.info("conversation.join", "Channel added to subscriptions", {
      userId,
      conversationId,
      channel,
    });
  }

  ctx.emit("conversation.joined", { conversationId });
});

// Create the Durable Object class
export const Chat = createActorHandler(chat.definition);
