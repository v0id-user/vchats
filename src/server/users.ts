import { createServerFn } from "@tanstack/react-start";
import * as usersService from "../service/users";
import { verifyJWT } from "../lib/auth.jwt";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("server:users");

// Helper to get user from token
async function getUserFromToken(token: string) {
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return { id: payload.sub, username: payload.username };
}

export const searchUsers = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string; token: string }) => d)
  .handler(async ({ data }) => {
    log.info("searchUsers", "Searching users", { query: data.query });
    const user = await getUserFromToken(data.token);
    if (!user) {
      log.warn("searchUsers", "Unauthorized");
      return { users: [] };
    }
    const users = await usersService.searchUsers(data.query, user.id);
    log.info("searchUsers", "User search completed", { query: data.query, userId: user.id, resultCount: users.length });
    return { users };
  });

export const getUserById = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string; token: string }) => d)
  .handler(async ({ data }) => {
    const currentUser = await getUserFromToken(data.token);
    if (!currentUser) {
      return { user: null };
    }
    const user = await usersService.getUserById(data.userId);
    return { user };
  });
