import { useDataSource } from "@/lib/advent-one/source";

export function StageBoundaryBanner() {
  return (
    <div className="h-10 bg-brand-teal/5 border-y border-brand-teal/10 flex items-center px-8 gap-3">
      <div className="size-1.5 rounded-full bg-brand-teal" />
      <p className="text-[11px] uppercase tracking-widest text-brand-teal/80 font-medium">
        Stage 1 = visible facts only. No bottleneck/ROI inference here.
      </p>
    </div>
  );
}

export function BackendErrorBanner({
  message,
  status,
}: {
  message: string;
  status?: number;
}) {
  const { forceMock } = useDataSource();
  const friendly =
    status === 503
      ? "Backend / model server unavailable. Mock demo still available."
      : message;
  return (
    <div className="bg-brand-amber/10 border border-brand-amber/30 text-brand-amber px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="size-1.5 rounded-full bg-brand-amber animate-pulse" />
        <p className="text-xs font-mono">
          {status ? `${status} · ` : ""}
          {friendly}
        </p>
      </div>
      <button
        onClick={forceMock}
        className="text-[10px] font-mono uppercase tracking-widest border border-brand-amber/40 px-3 py-1.5 hover:bg-brand-amber/10 cursor-pointer"
      >
        Switch to mock demo →
      </button>
    </div>
  );
}