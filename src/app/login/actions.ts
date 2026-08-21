"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotpToken } from "@/lib/auth/totp";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import {
  clearAttempts,
  isRateLimited,
  recordFailedAttempt,
} from "@/lib/auth/rate-limit";

export type LoginState = { error: string } | null;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const totpToken = String(formData.get("totpToken") ?? "").trim();
  const next = String(formData.get("next") ?? "/");

  if (!email || !password || !totpToken) {
    return { error: "이메일, 비밀번호, 인증 코드를 모두 입력해 주세요." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for") ?? "unknown";
  const rateLimitKey = `${email}:${ip}`;

  if (isRateLimited(rateLimitKey)) {
    return {
      error: "로그인 시도가 너무 많습니다. 5분 후 다시 시도해 주세요.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const genericError = "이메일, 비밀번호 또는 인증 코드가 올바르지 않습니다.";

  if (!user) {
    recordFailedAttempt(rateLimitKey);
    return { error: genericError };
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  const totpOk = verifyTotpToken(user.email, user.totpSecret, totpToken);

  if (!passwordOk || !totpOk) {
    recordFailedAttempt(rateLimitKey);
    return { error: genericError };
  }

  clearAttempts(rateLimitKey);

  const { token, maxAge } = createSessionToken(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  redirect(next.startsWith("/") ? next : "/");
}
