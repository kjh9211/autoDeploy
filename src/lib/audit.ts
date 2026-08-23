import { prisma } from "@/lib/db/prisma";
import type { $Enums } from "@/generated/prisma/client";

// Every control action gets one row, success or failure — read-only actions
// (status checks, git fetch) are not logged. docs/PLANNING.md §7.
export async function recordAudit(entry: {
  actorEmail: string;
  action: $Enums.AuditAction;
  appId: number;
  appName: string;
  success: boolean;
  detail?: string;
}) {
  await prisma.auditLog.create({ data: entry });
}
