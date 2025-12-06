import { createServerFn } from "@tanstack/react-start";
import * as conversationsService from "../service/conversations";
import * as messagesService from "../service/messages";
import { verifyJWT } from "../lib/auth.jwt";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("server:conversations");

// Helper to get user from token
async function getUserFromToken(token: string) {
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return { id: payload.sub, username: payload.username };
}

export const getConversations = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    log.info("getConversations", "Fetching conversations");
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("getConversations", "Unauthorized");
      return { conversations: [] };
    }
    const conversations = await conversationsService.getUserConversations(user.id);
    log.info("getConversations", "Conversations fetched", { userId: user.id, count: conversations.length });
    return { conversations };
  });

export const createDirectConversation = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("createDirectConversation", "Creating direct conversation", { targetUserId: data.userId });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("createDirectConversation", "Unauthorized");
      return { success: false, error: "Unauthorized" };
    }
    const result = await conversationsService.getOrCreateDirectConversation(user.id, data.userId);
    if (result.success) {
      log.info("createDirectConversation", "Direct conversation created", { userId: user.id, targetUserId: data.userId, conversationId: result.conversation?.id });
    } else {
      log.warn("createDirectConversation", "Failed to create conversation", { userId: user.id, targetUserId: data.userId, error: result.error });
    }
    return result;
  });

export const createGroupConversation = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; memberIds: string[]; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("createGroupConversation", "Creating group conversation", { name: data.name, memberCount: data.memberIds.length });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("createGroupConversation", "Unauthorized");
      return { success: false, error: "Unauthorized" };
    }
    const result = await conversationsService.createGroupConversation(user.id, data.name, data.memberIds);
    if (result.success) {
      log.info("createGroupConversation", "Group conversation created", { userId: user.id, name: data.name, conversationId: result.conversation?.id });
    } else {
      log.warn("createGroupConversation", "Failed to create group", { userId: user.id, name: data.name, error: result.error });
    }
    return result;
  });

export const getMessages = createServerFn({ method: "GET" })
  .inputValidator((d: { conversationId: string; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("getMessages", "Fetching messages", { conversationId: data.conversationId });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("getMessages", "Unauthorized");
      return { success: false, messages: [], error: "Unauthorized" };
    }
    const result = await messagesService.getMessages(data.conversationId, user.id);
    if (result.success) {
      log.info("getMessages", "Messages fetched", { conversationId: data.conversationId, userId: user.id, messageCount: result.messages?.length });
    } else {
      log.warn("getMessages", "Failed to fetch messages", { conversationId: data.conversationId, userId: user.id, error: result.error });
    }
    return result;
  });
