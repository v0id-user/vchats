import { db } from "../database/db";
import { messages, users } from "../schemas/db/schema";
import { eq, desc } from "drizzle-orm";
import { isConversationMember } from "./conversations";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("messages");

export interface MessageInfo {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: Date;
}

// Save a new message
export async function saveMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ success: boolean; message?: MessageInfo; error?: string }> {
  log.info("saveMessage", "Saving message", { conversationId, senderId, contentLength: content.length });

  // Verify sender is a member
  const isMember = await isConversationMember(conversationId, senderId);
  if (!isMember) {
    log.warn("saveMessage", "Sender not a member", { conversationId, senderId });
    return { success: false, error: "Not a member of this conversation" };
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(messages).values({
    id,
    conversationId,
    senderId,
    content,
    createdAt: now,
  });

  const sender = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, senderId))
    .get();

  log.info("saveMessage", "Message saved", { messageId: id, conversationId, senderId });

  return {
    success: true,
    message: {
      id,
      conversationId,
      senderId,
      senderUsername: sender?.username || "Unknown",
      content,
      createdAt: now,
    },
  };
}

// Get messages for a conversation (paginated)
export async function getMessages(
  conversationId: string,
  userId: string,
  limit: number = 50,
): Promise<{ success: boolean; messages?: MessageInfo[]; error?: string }> {
  log.info("getMessages", "Fetching messages", { conversationId, userId, limit });

  // Verify user is a member
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) {
    log.warn("getMessages", "User not a member", { conversationId, userId });
    return { success: false, error: "Not a member of this conversation" };
  }

  let query = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const results = await query.all();

  // Get sender usernames
  const messageInfos: MessageInfo[] = [];
  for (const msg of results) {
    const sender = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, msg.senderId))
      .get();
    messageInfos.push({
      ...msg,
      senderUsername: sender?.username || "Unknown",
    });
  }

  // Reverse to get chronological order
  messageInfos.reverse();

  log.info("getMessages", "Messages fetched", { conversationId, userId, messageCount: messageInfos.length });

  return { success: true, messages: messageInfos };
}

