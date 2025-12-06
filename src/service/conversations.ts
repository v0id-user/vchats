import { db } from "../database/db";
import { conversations, conversationMembers, users, messages } from "../schemas/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { areFriends } from "./friends";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("conversations");

export interface ConversationInfo {
  id: string;
  type: "direct" | "group";
  name: string | null;
  members: { id: string; username: string }[];
  lastMessage?: { content: string; createdAt: Date; senderUsername: string };
  createdAt: Date;
}

// Get or create a direct conversation between two users
export async function getOrCreateDirectConversation(
  userId1: string,
  userId2: string
): Promise<{ success: boolean; conversation?: ConversationInfo; error?: string }> {
  log.info("getOrCreateDirectConversation", "Attempting to get or create direct conversation", { userId1, userId2 });

  // Check if they are friends
  const friends = await areFriends(userId1, userId2);
  if (!friends) {
    log.warn("getOrCreateDirectConversation", "Users are not friends", { userId1, userId2 });
    return { success: false, error: "Must be friends to start a conversation" };
  }

  // Find existing direct conversation
  const user1Convos = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId1))
    .all();

  const user1ConvoIds = user1Convos.map((c) => c.conversationId);

  if (user1ConvoIds.length > 0) {
    // Find conversation where user2 is also a member and it's direct type
    for (const convoId of user1ConvoIds) {
      const convo = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, convoId), eq(conversations.type, "direct")))
        .get();

      if (convo) {
        const member2 = await db
          .select()
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, convoId),
              eq(conversationMembers.userId, userId2)
            )
          )
          .get();

        if (member2) {
          // Found existing conversation
          log.info("getOrCreateDirectConversation", "Found existing conversation", { conversationId: convoId, userId1, userId2 });
          const info = await getConversationInfo(convoId);
          return { success: true, conversation: info! };
        }
      }
    }
  }

  // Create new direct conversation
  const convoId = crypto.randomUUID();
  const now = new Date();

  await db.insert(conversations).values({
    id: convoId,
    type: "direct",
    name: null,
    createdAt: now,
  });

  await db.insert(conversationMembers).values([
    { id: crypto.randomUUID(), conversationId: convoId, userId: userId1, joinedAt: now },
    { id: crypto.randomUUID(), conversationId: convoId, userId: userId2, joinedAt: now },
  ]);

  log.info("getOrCreateDirectConversation", "Created new direct conversation", { conversationId: convoId, userId1, userId2 });

  const info = await getConversationInfo(convoId);
  return { success: true, conversation: info! };
}

// Create a group conversation
export async function createGroupConversation(
  creatorId: string,
  name: string,
  memberIds: string[]
): Promise<{ success: boolean; conversation?: ConversationInfo; error?: string }> {
  log.info("createGroupConversation", "Creating group conversation", { creatorId, name, memberCount: memberIds.length });

  // Ensure creator is included
  const allMemberIds = [...new Set([creatorId, ...memberIds])];

  // Check all members are friends with creator
  for (const memberId of memberIds) {
    if (memberId !== creatorId) {
      const friends = await areFriends(creatorId, memberId);
      if (!friends) {
        log.warn("createGroupConversation", "Creator not friends with member", { creatorId, memberId });
        return { success: false, error: `Must be friends with all group members` };
      }
    }
  }

  const convoId = crypto.randomUUID();
  const now = new Date();

  await db.insert(conversations).values({
    id: convoId,
    type: "group",
    name,
    createdAt: now,
  });

  const memberInserts = allMemberIds.map((userId) => ({
    id: crypto.randomUUID(),
    conversationId: convoId,
    userId,
    joinedAt: now,
  }));

  await db.insert(conversationMembers).values(memberInserts);

  log.info("createGroupConversation", "Group conversation created", { conversationId: convoId, creatorId, name, memberCount: allMemberIds.length });

  const info = await getConversationInfo(convoId);
  return { success: true, conversation: info! };
}

// Get conversation info by ID
export async function getConversationInfo(convoId: string): Promise<ConversationInfo | null> {
  const convo = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, convoId))
    .get();

  if (!convo) return null;

  // Get members
  const members = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(conversationMembers.userId, users.id))
    .where(eq(conversationMembers.conversationId, convoId))
    .all();

  // Get last message
  const lastMsg = await db
    .select({
      content: messages.content,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(eq(messages.conversationId, convoId))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();

  let lastMessage: ConversationInfo["lastMessage"];
  if (lastMsg) {
    const sender = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, lastMsg.senderId))
      .get();
    lastMessage = {
      content: lastMsg.content,
      createdAt: lastMsg.createdAt,
      senderUsername: sender?.username || "Unknown",
    };
  }

  return {
    id: convo.id,
    type: convo.type as "direct" | "group",
    name: convo.name,
    members,
    lastMessage,
    createdAt: convo.createdAt,
  };
}

// Get all conversations for a user
export async function getUserConversations(userId: string): Promise<ConversationInfo[]> {
  const memberEntries = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId))
    .all();

  const convoIds = memberEntries.map((e) => e.conversationId);
  if (convoIds.length === 0) return [];

  const convos: ConversationInfo[] = [];
  for (const convoId of convoIds) {
    const info = await getConversationInfo(convoId);
    if (info) convos.push(info);
  }

  // Sort by last message or creation time
  convos.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.createdAt;
    const bTime = b.lastMessage?.createdAt || b.createdAt;
    return bTime.getTime() - aTime.getTime();
  });

  return convos;
}

// Check if user is member of conversation
export async function isConversationMember(convoId: string, userId: string): Promise<boolean> {
  const member = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, convoId),
        eq(conversationMembers.userId, userId)
      )
    )
    .get();

  const isMember = !!member;
  if (!isMember) {
    log.debug("isConversationMember", "User is not a member", { conversationId: convoId, userId });
  }
  return isMember;
}

