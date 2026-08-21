import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

export const SESSION_COOKIE = "ops_console_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h — short-lived per docs/PLANNING.md §7

type SessionPayload = {
  uid: number;
  exp: number; // unix seconds
};

function sign(data: string): string {
  return createHmac("sha256", config.SESSION_SECRET)
    .update(data)
    .digest("base64url");
}

export function createSessionToken(userId: number): {
  token: string;
  maxAge: number;
} {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return { token: `${body}.${signature}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySessionToken(token: string | undefined): number | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }

  if (typeof payload.uid !== "number" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload.uid;
}
