import { createTypedConnection, createConnectionHandler } from "verani/typed";
import type { ConnectionMeta } from "verani/typed";
import { verifyJWT } from "../lib/auth.jwt";
import {
  isConversationMember,
  getUserConversations,
} from "../service/conversations";
import { saveMessage } from "../service/messages";
import { createScopedLogger } from "../lib/logger";
import { chatContract } from "../contracts/chat.contract";

const log = createScopedLogger("actor:connection");

interface ChatMeta extends ConnectionMeta {
  username: string;
}

const connection = createTypedConnection<
  typeof chatContract,
  ChatMeta
>(chatContract, {
  name: "UserConnection",
  websocketPath: "/chat",

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

    log.info("extractMeta", "User authenticated", {
      userId: payload.sub,
      username: payload.username,
    });

    return {
      userId: payload.sub,
      clientId: crypto.randomUUID(),
      channels: ["default"],
      username: payload.username,
    };
  },

  async onConnect(ctx) {
    log.info("onConnect", "User connected", {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
      clientId: ctx.meta.clientId,
    });

    // Join room for each conversation the user belongs to
    const conversations = await getUserConversations(ctx.meta.userId);
    for (const conv of conversations) {
      await ctx.actor.joinRoom(`conversation:${conv.id}`);
    }

    log.info("onConnect", "Joined conversation rooms", {
      userId: ctx.meta.userId,
      roomCount: conversations.length,
    });
  },

  onDisconnect(ctx) {
    log.info("onDisconnect", "User disconnected", {
      userId: ctx.meta.userId,
      username: ctx.meta.username,
      clientId: ctx.meta.clientId,
    });
    // Rooms are automatically left on disconnect
  },
});

// Add room/connection bindings to the underlying definition
// (TypedConnectionConfig doesn't expose these, but ConnectionDefinition supports them)
const def = connection.definition as any;
def.rooms = { conversation: "ChatRoom" };
def.connectionBinding = "UserConnection";

// Handle sending messages
connection.on("message.send", async (ctx, data) => {
  const { conversationId, text } = data;
  const { userId, username } = ctx.meta;

  log.info("message.send", "Message send request", {
    userId,
    username,
    conversationId,
    contentLength: text.length,
  });

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("message.send", "User not a member", { userId, conversationId });
    ctx.emit("error", {
      message: "Not a member of this conversation",
      code: "NOT_MEMBER",
    });
    return;
  }

  const result = await saveMessage(conversationId, userId, text);
  if (!result.success || !result.message) {
    log.error("message.send", "Failed to save message", {
      userId,
      conversationId,
      error: result.error,
    });
    ctx.emit("error", {
      message: result.error || "Failed to save message",
      code: "SAVE_ERROR",
    });
    return;
  }

  // Broadcast via RoomDO
  await ctx.emit.toRoom(`conversation:${conversationId}`).emit("chat.message", {
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

// Handle typing indicators
connection.on("typing.start", async (ctx, data) => {
  const { conversationId } = data;
  const { userId, username } = ctx.meta;

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return;

  await ctx.emit.toRoom(`conversation:${conversationId}`).emit("typing.start", {
    conversationId,
    userId,
    username,
  });
});

connection.on("typing.stop", async (ctx, data) => {
  const { conversationId } = data;
  const { userId, username } = ctx.meta;

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return;

  await ctx.emit.toRoom(`conversation:${conversationId}`).emit("typing.stop", {
    conversationId,
    userId,
    username,
  });
});

// Handle joining a conversation channel
connection.on("conversation.join", async (ctx, data) => {
  const { conversationId } = data;
  const { userId } = ctx.meta;

  log.info("conversation.join", "Joining conversation", {
    userId,
    conversationId,
  });

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("conversation.join", "User not a member", {
      userId,
      conversationId,
    });
    ctx.emit("error", {
      message: "Not a member of this conversation",
      code: "NOT_MEMBER",
    });
    return;
  }

  // Join the room via RoomDO
  await ctx.actor.joinRoom(`conversation:${conversationId}`);

  log.info("conversation.join", "Room joined", { userId, conversationId });
  ctx.emit("conversation.joined", { conversationId });
});

export const UserConnection = createConnectionHandler(connection.definition);
