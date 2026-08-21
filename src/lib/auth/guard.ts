import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function getSessionUser() {
  const jar = await cookies();
  const uid = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (uid === null) return null;

  return prisma.user.findUnique({ where: { id: uid } });
}

// Call at the top of any protected Server Component that needs the user.
// src/proxy.ts already blocks unauthenticated requests before they get this
// far; this is the defense-in-depth check plus a way to load the user row.
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
