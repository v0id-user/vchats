// Simple JWT implementation for Cloudflare Workers
// Uses Web Crypto API

const JWT_SECRET = "vchats-secret-key-change-in-production";
const JWT_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface JWTPayload {
  sub: string; // user id
  username: string;
  iat: number;
  exp: number;
}

// Base64url encode
function base64urlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Base64url decode
function base64urlDecode(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

// Create HMAC signature
async function createSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// Verify HMAC signature
async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSignature = await createSignature(data);
  return signature === expectedSignature;
}

// Sign a JWT token
export async function signJWT(userId: string, username: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Date.now();
  const payload: JWTPayload = {
    sub: userId,
    username,
    iat: now,
    exp: now + JWT_EXPIRY,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const data = `${headerEncoded}.${payloadEncoded}`;
  const signature = await createSignature(data);

  return `${data}.${signature}`;
}

// Verify and decode a JWT token
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;
    const data = `${headerEncoded}.${payloadEncoded}`;

    const isValid = await verifySignature(data, signature);
    if (!isValid) return null;

    const payload: JWTPayload = JSON.parse(base64urlDecode(payloadEncoded));

    // Check expiration
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

// Hash password using SHA-256
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

