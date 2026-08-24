import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DeployLiveView } from "./DeployLiveView";
import { RollbackButton } from "./RollbackButton";

const MODE_LABEL: Record<string, string> = {
  update: "업데이트",
  rollback: "롤백",
};

export default async function DeployDetailPage(props: PageProps<"/deploys/[id]">) {
  const { id } = await props.params;
  const deployLog = await prisma.deployLog.findUnique({ where: { id: Number(id) } });
  if (!deployLog) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">
          배포 #{deployLog.id} —{" "}
          <Link href={`/apps/${deployLog.appId}`} className="underline underline-offset-2">
            {deployLog.appName}
          </Link>
        </h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          {MODE_LABEL[deployLog.mode] ?? deployLog.mode} · {deployLog.triggeredBy} ·{" "}
          {deployLog.startedAt.toISOString().replace("T", " ").slice(0, 19)}
        </p>
        <p className="text-sm text-black/50 dark:text-white/50 font-mono">
          {deployLog.fromCommit?.slice(0, 10) ?? "?"} → {deployLog.toCommit?.slice(0, 10) ?? "?"}
        </p>
      </div>

      <DeployLiveView deployLogId={deployLog.id} initialStatus={deployLog.status} />

      {deployLog.status === "success" && deployLog.toCommit && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">롤백</h2>
          <RollbackButton deployId={deployLog.id} commit={deployLog.toCommit} />
        </section>
      )}
    </div>
  );
}
