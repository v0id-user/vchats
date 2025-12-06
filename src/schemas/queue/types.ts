// Queue message types for async database writes

export interface SaveMessagePayload {
  type: "save_message";
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string; // ISO string
}

export type QueueMessage = SaveMessagePayload;

