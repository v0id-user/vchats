import handleRequest from "@tanstack/react-start/server-entry";
import { Chat } from "./actors/chat.actor";
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
};

export { Chat };
