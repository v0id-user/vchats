import { createServerFn } from "@tanstack/react-start";
import * as authService from "../service/auth";
import { verifyJWT } from "../lib/auth.jwt";
import { createScopedLogger } from "../lib/logger";

const log = createScopedLogger("server:auth");

export const register = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) => d)
  .handler(async ({ data }) => {
    log.info("register", "Registration request", { username: data.username });
    const result = await authService.register(data);
    if (result.success) {
      log.info("register", "Registration successful", { username: data.username, userId: result.user?.id });
    } else {
      log.warn("register", "Registration failed", { username: data.username, error: result.error });
    }
    return result;
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) => d)
  .handler(async ({ data }) => {
    log.info("login", "Login request", { username: data.username });
    const result = await authService.login(data);
    if (result.success) {
      log.info("login", "Login successful", { username: data.username, userId: result.user?.id });
    } else {
      log.warn("login", "Login failed", { username: data.username, error: result.error });
    }
    return result;
  });

export const verifyToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    log.debug("verifyToken", "Token verification request");
    const payload = await verifyJWT(data.token);
    if (!payload) {
      log.warn("verifyToken", "Invalid token");
      return { valid: false };
    }
    log.debug("verifyToken", "Token verified", { userId: payload.sub, username: payload.username });
    return {
      valid: true,
      user: { id: payload.sub, username: payload.username },
    };
  });
