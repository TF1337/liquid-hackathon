import { useState } from "react";
import { BADGE_LABEL, useDataSource } from "@/lib/advent-one/source";
import { cn } from "@/lib/utils";

const COLOR: Record<string, string> = {
  mock: "border-white/15 text-white/50",
  live: "border-brand-teal/40 text-brand-teal",
  "auto-live": "border-brand-teal/40 text-brand-teal",
  "auto-mock-fallback": "border-brand-amber/40 text-brand-amber",
};

export function DataSourceBadge() {
  const { badge, mode, configured, forceMock, retryLive, probing } = useDataSource();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5",
          COLOR[badge],
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            mode === "live" ? "bg-brand-teal" : "bg-brand-amber",
            probing && "animate-pulse",
          )}
        />
        {BADGE_LABEL[badge]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-background border border-white/10 p-4 z-50 shadow-xl">
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-2">
              Data source
            </div>
            <div className="text-xs text-white/70 leading-relaxed mb-3">
              configured: <span className="font-mono text-white">{configured}</span>
              <br />
              active mode: <span className="font-mono text-white">{mode}</span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  forceMock();
                  setOpen(false);
                }}
                disabled={mode === "mock" && configured !== "live"}
                className="text-left text-xs px-3 py-2 border border-white/15 hover:border-white/30 hover:text-white text-white/80 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Switch to mock demo
              </button>
              <button
                onClick={() => {
                  retryLive();
                  setOpen(false);
                }}
                className="text-left text-xs px-3 py-2 border border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 transition-colors cursor-pointer"
              >
                Try live backend again
              </button>
            </div>
            <p className="mt-3 text-[10px] font-mono text-white/30 leading-relaxed">
              The mock demo always works without the Python backend.
            </p>
          </div>
        </>
      )}
    </div>
  );
}