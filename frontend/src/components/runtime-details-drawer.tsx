import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { runtimeDetails } from "@/mocks/hardware";
import { useDataSource } from "@/lib/advent-one/source";
import { useLiveHealth } from "@/lib/advent-one/queries";
import { getAdventOneUrl } from "@/lib/advent-one/client";

const ROWS: { label: string; key: keyof typeof runtimeDetails; mono?: boolean }[] = [
  { label: "backend", key: "backend", mono: true },
  { label: "cli_path", key: "cli_path", mono: true },
  { label: "model_path", key: "model_path", mono: true },
  { label: "mmproj_path", key: "mmproj_path", mono: true },
  { label: "grammar_file", key: "grammar_file", mono: true },
  { label: "schema_file", key: "schema_file", mono: true },
  { label: "manual_fallback", key: "manual_fallback" },
];

export function RuntimeDetailsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mode } = useDataSource();
  const isLive = mode === "live";
  const health = useLiveHealth(open && isLive);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-none bg-background border-white/10 text-foreground">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-foreground">Runtime Details</SheetTitle>
          <SheetDescription className="text-white/40 text-xs font-mono uppercase tracking-widest">
            {isLive
              ? `live — ${getAdventOneUrl()}`
              : "mock — static paths"}
          </SheetDescription>
        </SheetHeader>
        {isLive && (
          <div className="mt-6 border border-brand-teal/20 bg-brand-teal/5 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-brand-teal mb-3">
              /health · refresh 5s
            </div>
            {health.isError && (
              <div className="text-xs text-brand-amber font-mono">
                health probe failed: {(health.error as Error).message}
              </div>
            )}
            {health.data && (
              <div className="grid grid-cols-[160px_1fr] gap-y-2 text-xs">
                <div className="text-white/40 font-mono uppercase tracking-wider">vl_server</div>
                <div className={health.data.vl_server ? "text-brand-teal" : "text-brand-amber"}>
                  {health.data.vl_server ? "online" : "offline"}
                </div>
                <div className="text-white/40 font-mono uppercase tracking-wider">jp_server</div>
                <div className={health.data.jp_server ? "text-brand-teal" : "text-brand-amber"}>
                  {health.data.jp_server ? "online" : "offline"}
                </div>
                <div className="text-white/40 font-mono uppercase tracking-wider">ingestion_status</div>
                <div className="font-mono text-white/80">{health.data.ingestion_status}</div>
                <div className="text-white/40 font-mono uppercase tracking-wider">captured_count</div>
                <div className="font-mono text-white/80">{health.data.captured_count}</div>
              </div>
            )}
          </div>
        )}
        <div className="mt-8 divide-y divide-white/5 border-t border-b border-white/5">
          {ROWS.map((row) => {
            const value = runtimeDetails[row.key];
            return (
              <div key={row.key} className="grid grid-cols-[140px_1fr] gap-4 py-3 text-xs">
                <div className="text-white/30 font-mono uppercase tracking-wider">{row.label}</div>
                <div
                  className={
                    row.mono
                      ? "font-mono text-white/80 break-all"
                      : "text-white/80"
                  }
                >
                  {String(value)}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[11px] text-white/30 leading-relaxed">
          Stage 1 is the validated <span className="font-mono text-brand-teal">llama-mtmd-cli</span>{" "}
          flow with Liquid LFM2.5-VL Extract GGUF, matching <span className="font-mono">mmproj</span>{" "}
          and a grammar file for deterministic structured JSON.
        </p>
      </SheetContent>
    </Sheet>
  );
}