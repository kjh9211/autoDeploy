import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/login", request.url));
}
