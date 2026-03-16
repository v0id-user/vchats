import { createTypedConnection, createConnectionHandler } from "verani/typed";
import type { ConnectionMeta } from "verani/typed";
import { verifyJWT } from "../lib/auth.jwt";
import {
  isConversationMember,
  getConversationMemberIds,
} from "../service/conversations";
import { saveMessage } from "../service/messages";
import { createScopedLogger } from "../lib/logger";
import { chatContract } from "../contracts/chat.contract";

const log = createScopedLogger("actor:connection");

interface ChatMeta extends ConnectionMeta {
  username: string;
}

const connection = createTypedConnection<typeof chatContract, ChatMeta>(
  chatContract,
  {
    name: "UserConnection",
    websocketPath: "/chat",
    connectionBinding: "UserConnection",

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

    onConnect(ctx) {
      log.info("onConnect", "User connected", {
        userId: ctx.meta.userId,
        username: ctx.meta.username,
        clientId: ctx.meta.clientId,
      });
    },

    onDisconnect(ctx) {
      log.info("onDisconnect", "User disconnected", {
        userId: ctx.meta.userId,
        username: ctx.meta.username,
        clientId: ctx.meta.clientId,
      });
    },
  }
);

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

  const messageData = {
    id: result.message.id,
    conversationId,
    from: userId,
    fromUsername: username,
    text,
    timestamp: result.message.createdAt.getTime(),
  };

  // Deliver to ALL conversation members (including sender) via direct RPC
  const memberIds = await getConversationMemberIds(conversationId);
  await Promise.all(
    memberIds.map((memberId) =>
      ctx.emit.toUser(memberId).emit("chat.message", messageData)
    )
  );

  log.info("message.send", "Message saved and delivered", {
    messageId: result.message.id,
    conversationId,
    userId,
    recipientCount: memberIds.length,
  });
});

// Handle typing indicators
connection.on("typing.start", async (ctx, data) => {
  const { conversationId } = data;
  const { userId, username } = ctx.meta;

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return;

  const memberIds = await getConversationMemberIds(conversationId);
  const otherMembers = memberIds.filter((id) => id !== userId);

  await Promise.all(
    otherMembers.map((memberId) =>
      ctx.emit
        .toUser(memberId)
        .emit("typing.start", { conversationId, userId, username })
    )
  );
});

connection.on("typing.stop", async (ctx, data) => {
  const { conversationId } = data;
  const { userId, username } = ctx.meta;

  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) return;

  const memberIds = await getConversationMemberIds(conversationId);
  const otherMembers = memberIds.filter((id) => id !== userId);

  await Promise.all(
    otherMembers.map((memberId) =>
      ctx.emit
        .toUser(memberId)
        .emit("typing.stop", { conversationId, userId, username })
    )
  );
});

// Handle joining a conversation channel (no-op for room joining, just ack)
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

  ctx.emit("conversation.joined", { conversationId });
});

export const UserConnection = createConnectionHandler(connection.definition);
