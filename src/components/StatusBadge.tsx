import { HEALTH_DOT_CLASS, HEALTH_LABEL, type Health } from "@/lib/status";

export function StatusBadge({
  health,
  detail,
}: {
  health: Health;
  detail?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${HEALTH_DOT_CLASS[health]}`}
        aria-hidden
      />
      {detail ?? HEALTH_LABEL[health]}
    </span>
  );
}
