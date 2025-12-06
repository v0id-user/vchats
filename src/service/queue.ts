import { env } from "cloudflare:workers";
import type { SaveMessagePayload, QueueMessage } from "../schemas/queue/types";
import { db } from "../database/db";
import { messages, users } from "../schemas/db/schema";
import { eq } from "drizzle-orm";
import { isConversationMember } from "./conversations";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("queue");

// Send a message save to the queue (async write)
export async function queueSaveMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ success: boolean; messageId: string; error?: string }> {
  log.info("queueSaveMessage", "Queuing message save", { conversationId, senderId, contentLength: content.length });

  // Verify sender is a member (do this check before queuing)
  const isMember = await isConversationMember(conversationId, senderId);
  if (!isMember) {
    log.warn("queueSaveMessage", "Sender not a member", { conversationId, senderId });
    return { success: false, messageId: "", error: "Not a member of this conversation" };
  }

  const messageId = crypto.randomUUID();
  const payload: SaveMessagePayload = {
    type: "save_message",
    id: messageId,
    conversationId,
    senderId,
    content,
    createdAt: new Date().toISOString(),
  };

  await env.vchats_queue.send(payload);

  log.info("queueSaveMessage", "Message queued", { messageId, conversationId, senderId });

  return { success: true, messageId };
}

// Process queue messages (called from worker queue handler)
export async function processQueueMessage(message: QueueMessage): Promise<void> {
  log.info("processQueueMessage", "Processing queue message", { messageType: message.type });

  try {
    switch (message.type) {
      case "save_message":
        await processSaveMessage(message);
        break;
      default:
        log.error("processQueueMessage", "Unknown queue message type", { messageType: message.type });
    }
  } catch (error) {
    log.error("processQueueMessage", "Failed to process queue message", { messageType: message.type, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// Process save message from queue
async function processSaveMessage(payload: SaveMessagePayload): Promise<void> {
  log.info("processSaveMessage", "Saving message from queue", { messageId: payload.id, conversationId: payload.conversationId, senderId: payload.senderId });

  await db.insert(messages).values({
    id: payload.id,
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    content: payload.content,
    createdAt: new Date(payload.createdAt),
  });

  log.info("processSaveMessage", "Message saved to database", { messageId: payload.id });
}

// Get sender username for real-time broadcast (used by actor)
export async function getSenderUsername(senderId: string): Promise<string> {
  const sender = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, senderId))
    .get();
  return sender?.username || "Unknown";
}

