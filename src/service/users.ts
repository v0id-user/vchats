import { db } from "../database/db";
import { users } from "../schemas/db/schema";
import { eq, like, and, ne } from "drizzle-orm";

export interface UserInfo {
  id: string;
  username: string;
}

export async function getUserById(id: string): Promise<UserInfo | null> {
  const user = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .get();

  return user || null;
}

export async function getUserByUsername(username: string): Promise<UserInfo | null> {
  const user = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .get();

  return user || null;
}

export async function searchUsers(query: string, excludeUserId?: string): Promise<UserInfo[]> {
  if (!query || query.length < 2) return [];

  const conditions = [like(users.username, `%${query}%`)];
  
  if (excludeUserId) {
    conditions.push(ne(users.id, excludeUserId));
  }

  const results = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(...conditions))
    .limit(20)
    .all();

  return results;
}

