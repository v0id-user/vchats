import { createTypedClient, type VeraniClientOptions, type ConnectionState } from "verani/typed/client";
import { chatContract } from "../contracts/chat.contract";

export type { VeraniClientOptions as ChatClientOptions, ConnectionState };

/**
 * Creates a type-safe chat client based on the chat contract.
 * All events are automatically typed - no manual validation needed.
 */
export function createChatClient(url: string, options?: VeraniClientOptions) {
  return createTypedClient(chatContract, url, options);
}

export type ChatClient = ReturnType<typeof createChatClient>;
