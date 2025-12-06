import { z } from "zod";

// message.send - Send a message to a conversation
export const MessageSendSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().min(1).max(4000),
});
export type MessageSendRequest = z.infer<typeof MessageSendSchema>;

// typing.start - Start typing indicator
export const TypingStartSchema = z.object({
  conversationId: z.string().uuid(),
});
export type TypingStartRequest = z.infer<typeof TypingStartSchema>;

// typing.stop - Stop typing indicator
export const TypingStopSchema = z.object({
  conversationId: z.string().uuid(),
});
export type TypingStopRequest = z.infer<typeof TypingStopSchema>;

// conversation.join - Join a conversation channel
export const ConversationJoinSchema = z.object({
  conversationId: z.string().uuid(),
});
export type ConversationJoinRequest = z.infer<typeof ConversationJoinSchema>;

// Event name to schema mapping
export const RequestSchemas = {
  "message.send": MessageSendSchema,
  "typing.start": TypingStartSchema,
  "typing.stop": TypingStopSchema,
  "conversation.join": ConversationJoinSchema,
} as const;

export type RequestEventName = keyof typeof RequestSchemas;
