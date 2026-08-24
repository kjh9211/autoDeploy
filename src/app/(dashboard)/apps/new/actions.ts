"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { appFormBaseSchema, withRuntimeRefinements } from "@/lib/appFormSchema";

const schema = withRuntimeRefinements(appFormBaseSchema);

export type CreateAppState = { error: string } | null;

export async function createApp(
  _prevState: CreateAppState,
  formData: FormData,
): Promise<CreateAppState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  let created: { id: number };
  try {
    created = await prisma.app.create({ data: parsed.data });
  } catch {
    return { error: "이미 같은 이름의 앱이 등록되어 있습니다." };
  }

  redirect(`/apps/${created.id}`);
}
