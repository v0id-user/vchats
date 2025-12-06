import { db } from "../database/db";
import { friendRequests, users } from "../schemas/db/schema";
import { eq, and, or } from "drizzle-orm";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("friends");

export interface FriendRequestInfo {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

export interface FriendInfo {
  id: string;
  username: string;
}

// Send a friend request
export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<{ success: boolean; error?: string }> {
  log.info("sendFriendRequest", "Sending friend request", { fromUserId, toUserId });

  // Can't send to yourself
  if (fromUserId === toUserId) {
    log.warn("sendFriendRequest", "Attempted to send request to self", { fromUserId });
    return { success: false, error: "Cannot send friend request to yourself" };
  }

  // Check if request already exists (in either direction)
  const existing = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(
          eq(friendRequests.fromUserId, fromUserId),
          eq(friendRequests.toUserId, toUserId)
        ),
        and(
          eq(friendRequests.fromUserId, toUserId),
          eq(friendRequests.toUserId, fromUserId)
        )
      )
    )
    .get();

  if (existing) {
    if (existing.status === "accepted") {
      log.warn("sendFriendRequest", "Users already friends", { fromUserId, toUserId });
      return { success: false, error: "Already friends" };
    }
    if (existing.status === "pending") {
      log.warn("sendFriendRequest", "Friend request already pending", { fromUserId, toUserId });
      return { success: false, error: "Friend request already pending" };
    }
  }

  const id = crypto.randomUUID();
  await db.insert(friendRequests).values({
    id,
    fromUserId,
    toUserId,
    status: "pending",
    createdAt: new Date(),
  });

  log.info("sendFriendRequest", "Friend request sent", { requestId: id, fromUserId, toUserId });

  return { success: true };
}

// Accept a friend request
export async function acceptFriendRequest(requestId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  log.info("acceptFriendRequest", "Accepting friend request", { requestId, userId });

  const request = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, requestId))
    .get();

  if (!request) {
    log.warn("acceptFriendRequest", "Request not found", { requestId, userId });
    return { success: false, error: "Request not found" };
  }

  if (request.toUserId !== userId) {
    log.warn("acceptFriendRequest", "Unauthorized - not recipient", { requestId, userId, toUserId: request.toUserId });
    return { success: false, error: "Not authorized" };
  }

  if (request.status !== "pending") {
    log.warn("acceptFriendRequest", "Request already processed", { requestId, status: request.status });
    return { success: false, error: "Request already processed" };
  }

  await db
    .update(friendRequests)
    .set({ status: "accepted" })
    .where(eq(friendRequests.id, requestId));

  log.info("acceptFriendRequest", "Friend request accepted", { requestId, fromUserId: request.fromUserId, toUserId: request.toUserId });

  return { success: true };
}

// Reject a friend request
export async function rejectFriendRequest(requestId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  log.info("rejectFriendRequest", "Rejecting friend request", { requestId, userId });

  const request = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, requestId))
    .get();

  if (!request) {
    log.warn("rejectFriendRequest", "Request not found", { requestId, userId });
    return { success: false, error: "Request not found" };
  }

  if (request.toUserId !== userId) {
    log.warn("rejectFriendRequest", "Unauthorized - not recipient", { requestId, userId, toUserId: request.toUserId });
    return { success: false, error: "Not authorized" };
  }

  if (request.status !== "pending") {
    log.warn("rejectFriendRequest", "Request already processed", { requestId, status: request.status });
    return { success: false, error: "Request already processed" };
  }

  await db
    .update(friendRequests)
    .set({ status: "rejected" })
    .where(eq(friendRequests.id, requestId));

  log.info("rejectFriendRequest", "Friend request rejected", { requestId, fromUserId: request.fromUserId, toUserId: request.toUserId });

  return { success: true };
}

// Get pending requests for a user (incoming)
export async function getIncomingRequests(userId: string): Promise<FriendRequestInfo[]> {
  const requests = await db
    .select({
      id: friendRequests.id,
      fromUserId: friendRequests.fromUserId,
      toUserId: friendRequests.toUserId,
      status: friendRequests.status,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.toUserId, userId),
        eq(friendRequests.status, "pending")
      )
    )
    .all();

  // Get usernames
  const result: FriendRequestInfo[] = [];
  for (const req of requests) {
    const fromUser = await db.select({ username: users.username }).from(users).where(eq(users.id, req.fromUserId)).get();
    const toUser = await db.select({ username: users.username }).from(users).where(eq(users.id, req.toUserId)).get();
    result.push({
      ...req,
      fromUsername: fromUser?.username || "Unknown",
      toUsername: toUser?.username || "Unknown",
    });
  }

  return result;
}

// Get outgoing requests
export async function getOutgoingRequests(userId: string): Promise<FriendRequestInfo[]> {
  const requests = await db
    .select({
      id: friendRequests.id,
      fromUserId: friendRequests.fromUserId,
      toUserId: friendRequests.toUserId,
      status: friendRequests.status,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.fromUserId, userId),
        eq(friendRequests.status, "pending")
      )
    )
    .all();

  const result: FriendRequestInfo[] = [];
  for (const req of requests) {
    const fromUser = await db.select({ username: users.username }).from(users).where(eq(users.id, req.fromUserId)).get();
    const toUser = await db.select({ username: users.username }).from(users).where(eq(users.id, req.toUserId)).get();
    result.push({
      ...req,
      fromUsername: fromUser?.username || "Unknown",
      toUsername: toUser?.username || "Unknown",
    });
  }

  return result;
}

// Get all friends (accepted requests)
export async function getFriends(userId: string): Promise<FriendInfo[]> {
  const accepted = await db
    .select({
      fromUserId: friendRequests.fromUserId,
      toUserId: friendRequests.toUserId,
    })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "accepted"),
        or(
          eq(friendRequests.fromUserId, userId),
          eq(friendRequests.toUserId, userId)
        )
      )
    )
    .all();

  const friendIds = accepted.map((r) =>
    r.fromUserId === userId ? r.toUserId : r.fromUserId
  );

  const friends: FriendInfo[] = [];
  for (const friendId of friendIds) {
    const user = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, friendId))
      .get();
    if (user) {
      friends.push(user);
    }
  }

  return friends;
}

// Check if two users are friends
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const request = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "accepted"),
        or(
          and(
            eq(friendRequests.fromUserId, userId1),
            eq(friendRequests.toUserId, userId2)
          ),
          and(
            eq(friendRequests.fromUserId, userId2),
            eq(friendRequests.toUserId, userId1)
          )
        )
      )
    )
    .get();

  return !!request;
}

