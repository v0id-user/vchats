import { db } from "../database/db";
import { users } from "../schemas/db/schema";
import { eq } from "drizzle-orm";
import { signJWT, hashPassword, verifyPassword } from "../lib/auth.jwt";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("auth");

export interface RegisterInput {
  username: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: { id: string; username: string };
  error?: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { username, password } = input;

  log.info("register", "Registration attempt", { username });

  // Check if username exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (existing) {
    log.warn("register", "Username already taken", { username });
    return { success: false, error: "Username already taken" };
  }

  // Create user
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    username,
    passwordHash,
    createdAt: new Date(),
  });

  // Generate token
  const token = await signJWT(id, username);

  log.info("register", "User registered successfully", { userId: id, username });

  return {
    success: true,
    token,
    user: { id, username },
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const { username, password } = input;

  log.info("login", "Login attempt", { username });

  // Find user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (!user) {
    log.warn("login", "Login failed - user not found", { username });
    return { success: false, error: "Invalid credentials" };
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    log.warn("login", "Login failed - invalid password", { username, userId: user.id });
    return { success: false, error: "Invalid credentials" };
  }

  // Generate token
  const token = await signJWT(user.id, user.username);

  log.info("login", "Login successful", { userId: user.id, username });

  return {
    success: true,
    token,
    user: { id: user.id, username: user.username },
  };
}

