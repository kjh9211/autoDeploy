export function LoadingOverlay({
  show,
  label = "처리 중…",
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 bg-background px-6 py-5 shadow-lg">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-black/15 dark:border-white/20 border-t-foreground" />
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}
