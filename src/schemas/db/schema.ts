import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Users table - Basic auth
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Conversations table - Rooms for 1-to-1 and groups
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["direct", "group"] }).notNull(),
  name: text("name"), // nullable, only for groups
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Conversation members - Who belongs to which conversation
export const conversationMembers = sqliteTable("conversation_members", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  userId: text("user_id").notNull().references(() => users.id),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
});

// Messages - Persisted messages
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  senderId: text("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Friend requests - Request system (must accept before chatting)
export const friendRequests = sqliteTable("friend_requests", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id").notNull().references(() => users.id),
  toUserId: text("to_user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type NewConversationMember = typeof conversationMembers.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type NewFriendRequest = typeof friendRequests.$inferInsert;

