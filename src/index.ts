import handleRequest from "@tanstack/react-start/server-entry";
import { UserConnection } from "./actors/connection";
import { ChatRoom } from "./actors/chat-room";
import { verifyJWT } from "./lib/auth.jwt";
import { createScopedLogger } from "./lib/logger";

const log = createScopedLogger("worker");

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Handle WebSocket connections - route to per-user ConnectionDO
    if (url.pathname.startsWith("/chat")) {
      log.info("fetch", "WebSocket connection request", {
        pathname: url.pathname,
      });

      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Missing token", { status: 401 });
      }

      const payload = await verifyJWT(token);
      if (!payload) {
        return new Response("Invalid token", { status: 401 });
      }

      // Per-user routing: each user gets their own ConnectionDO
      const stub = UserConnection.get(payload.sub);
      return await stub.fetch(request);
    }

    // Handle React app (TanStack Start handles server functions automatically)
    log.debug("fetch", "HTTP request", {
      method: request.method,
      pathname: url.pathname,
    });
    return await handleRequest.fetch(request);
  },
};

export { UserConnection, ChatRoom };
