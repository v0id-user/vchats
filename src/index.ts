import handleRequest from "@tanstack/react-start/server-entry";
import { Chat } from "./actors/chat.actor";
import { processQueueMessage } from "./service/queue";
import type { QueueMessage } from "./schemas/queue/types";
import { createScopedLogger } from "./lib/logger";

const log = createScopedLogger("worker");

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Handle WebSocket connections to chat actor
    if (url.pathname.startsWith("/chat")) {
      log.info("fetch", "WebSocket connection request", { pathname: url.pathname });
      const stub = Chat.get("vchats");
      return await stub.fetch(request);
    }

    // Handle React app (TanStack Start handles server functions automatically)
    log.debug("fetch", "HTTP request", { method: request.method, pathname: url.pathname });
    return await handleRequest.fetch(request);
  },

  // Queue consumer for async database writes
  async queue(batch: MessageBatch<QueueMessage>, _env: Env, _ctx: ExecutionContext) {
    log.info("queue", "Processing queue batch", { messageCount: batch.messages.length });

    for (const message of batch.messages) {
      try {
        await processQueueMessage(message.body);
        message.ack();
        log.debug("queue", "Message processed successfully", { messageType: message.body.type });
      } catch (error) {
        log.error("queue", "Failed to process queue message", {
          messageType: message.body.type,
          error: error instanceof Error ? error.message : String(error),
        });
        message.retry();
      }
    }

    log.info("queue", "Queue batch processing completed", { messageCount: batch.messages.length });
  },
};

export { Chat };
