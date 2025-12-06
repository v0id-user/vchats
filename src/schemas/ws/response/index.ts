import { z } from "zod";

// chat.message - New message received
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  from: z.string().uuid(),
  fromUsername: z.string(),
  text: z.string(),
  timestamp: z.number(),
});
export type ChatMessageResponse = z.infer<typeof ChatMessageSchema>;

// typing.start - User started typing
export const TypingStartResponseSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string(),
});
export type TypingStartResponse = z.infer<typeof TypingStartResponseSchema>;

// typing.stop - User stopped typing
export const TypingStopResponseSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string(),
});
export type TypingStopResponse = z.infer<typeof TypingStopResponseSchema>;

// user.joined - User joined the room
export const UserJoinedSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
});
export type UserJoinedResponse = z.infer<typeof UserJoinedSchema>;

// user.left - User left the room
export const UserLeftSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
});
export type UserLeftResponse = z.infer<typeof UserLeftSchema>;

// conversation.joined - Successfully joined conversation channel
export const ConversationJoinedSchema = z.object({
  conversationId: z.string().uuid(),
});
export type ConversationJoinedResponse = z.infer<typeof ConversationJoinedSchema>;

// error - Error response
export const ErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorSchema>;

// Event name to schema mapping
export const ResponseSchemas = {
  "chat.message": ChatMessageSchema,
  "typing.start": TypingStartResponseSchema,
  "typing.stop": TypingStopResponseSchema,
  "user.joined": UserJoinedSchema,
  "user.left": UserLeftSchema,
  "conversation.joined": ConversationJoinedSchema,
  "error": ErrorSchema,
} as const;

export type ResponseEventName = keyof typeof ResponseSchemas;
