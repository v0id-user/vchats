import { createServerFn } from "@tanstack/react-start";
import * as friendsService from "../service/friends";
import { verifyJWT } from "../lib/auth.jwt";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("server:friends");

// Helper to get user from token
async function getUserFromToken(token: string) {
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return { id: payload.sub, username: payload.username };
}

export const sendFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { toUserId: string; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("sendFriendRequest", "Sending friend request", { toUserId: data.toUserId });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("sendFriendRequest", "Unauthorized");
      return { success: false, error: "Unauthorized" };
    }
    const result = await friendsService.sendFriendRequest(user.id, data.toUserId);
    if (!result.success) {
      log.warn("sendFriendRequest", "Failed to send request", { userId: user.id, toUserId: data.toUserId, error: result.error });
    }
    return result;
  });

export const acceptFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: string; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("acceptFriendRequest", "Accepting friend request", { requestId: data.requestId });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("acceptFriendRequest", "Unauthorized");
      return { success: false, error: "Unauthorized" };
    }
    const result = await friendsService.acceptFriendRequest(data.requestId, user.id);
    if (!result.success) {
      log.warn("acceptFriendRequest", "Failed to accept request", { requestId: data.requestId, userId: user.id, error: result.error });
    }
    return result;
  });

export const rejectFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: string; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("rejectFriendRequest", "Rejecting friend request", { requestId: data.requestId });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("rejectFriendRequest", "Unauthorized");
      return { success: false, error: "Unauthorized" };
    }
    const result = await friendsService.rejectFriendRequest(data.requestId, user.id);
    if (!result.success) {
      log.warn("rejectFriendRequest", "Failed to reject request", { requestId: data.requestId, userId: user.id, error: result.error });
    }
    return result;
  });

export const getIncomingRequests = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const user = await getUserFromToken(data.token);
    if (!user) {
      return { requests: [] };
    }
    const requests = await friendsService.getIncomingRequests(user.id);
    return { requests };
  });

export const getOutgoingRequests = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const user = await getUserFromToken(data.token);
    if (!user) {
      return { requests: [] };
    }
    const requests = await friendsService.getOutgoingRequests(user.id);
    return { requests };
  });

export const getFriends = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const user = await getUserFromToken(data.token);
    if (!user) {
      return { friends: [] };
    }
    const friends = await friendsService.getFriends(user.id);
    return { friends };
  });
