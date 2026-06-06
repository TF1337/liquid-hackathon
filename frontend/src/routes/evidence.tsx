import { createFileRoute, Link } from "@tanstack/react-router";
import { evidenceRecords as mockRecords } from "@/mocks/evidence";
import { StageBoundaryBanner, BackendErrorBanner } from "@/components/stage-banner";
import { TelemetryStrip } from "@/components/telemetry-strip";
import { useDataSource } from "@/lib/advent-one/source";
import { useLiveFacts } from "@/lib/advent-one/queries";
import { adaptFactToEvidence } from "@/lib/advent-one/adapters";

export const Route = createFileRoute("/evidence")({
  head: () => ({
    meta: [
      { title: "Advent One — Evidence" },
      { name: "description", content: "Stage 1 evidence records extracted from Sakura Logistics site capture." },
    ],
  }),
  component: EvidenceList,
});

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} · ${d.toISOString().slice(11, 16)} JST`;
}

function EvidenceList() {
  const { mode } = useDataSource();
  const isLive = mode === "live";
  const facts = useLiveFacts(isLive);

  const records = isLive
    ? (facts.data ?? []).map((f) => adaptFactToEvidence(f))
    : mockRecords;

  const showError = isLive && facts.isError;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-12 py-12">
          {showError && (
            <div className="mb-8">
              <BackendErrorBanner
                message={(facts.error as Error).message}
                status={(facts.error as Error & { status?: number }).status}
              />
            </div>
          )}
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
                Stage 1 · Evidence
              </div>
              <h1 className="font-display text-4xl font-medium tracking-tight">
                Extracted records
              </h1>
              <p className="text-sm text-white/50 mt-3 max-w-[60ch]">
                Each record is the result of a single image passing through{" "}
                <span className="font-mono text-brand-teal">mtmd_cli</span> with a grammar-bound
                schema. Visible facts only.
              </p>
            </div>
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              {records.length} records · target: Sakura Logistics
              {isLive && <span className="ml-2 text-brand-teal">· live</span>}
            </div>
          </div>

          {records.length === 0 && !showError && (
            <div className="border border-dashed border-white/15 p-12 text-center">
              <p className="text-sm text-white/60">
                No evidence captured yet.
              </p>
              <Link
                to="/capture"
                className="inline-block mt-4 text-xs font-mono text-brand-orange uppercase tracking-widest hover:underline"
              >
                Go to capture →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-white/5 border border-white/5">
            {records.map((r) => (
              <Link
                key={r.id}
                to="/evidence/$id"
                params={{ id: r.id }}
                className="group bg-panel hover:bg-surface transition-colors p-6 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                    {r.id}
                  </div>
                  <div
                    className={
                      r.source === "trigger"
                        ? "text-[10px] font-mono text-brand-teal uppercase tracking-wider"
                        : "text-[10px] font-mono text-white/30 uppercase tracking-wider"
                    }
                  >
                    {r.source}
                  </div>
                </div>
                <div className="aspect-[4/3] bg-stone-200 overflow-hidden mb-4 ring-1 ring-black/40">
                  {r.image ? (
                    <img
                      src={r.image}
                      alt={r.title}
                      loading="lazy"
                      width={400}
                      height={300}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-panel text-[10px] font-mono text-white/30 uppercase tracking-widest">
                      no image stored
                    </div>
                  )}
                </div>
                <div className="font-display text-lg leading-snug mb-3 text-balance">
                  {r.title}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-white/40 mb-4">
                  <div>type</div>
                  <div className="text-white/70 text-right">{r.extraction.document_type}</div>
                  <div>lang</div>
                  <div className="text-white/70 text-right">{r.extraction.language}</div>
                  <div>fields</div>
                  <div className="text-white/70 text-right">{r.extraction.fields.length}</div>
                  <div>line_items</div>
                  <div className="text-white/70 text-right">{r.extraction.line_items.length}</div>
                  <div>unreadable</div>
                  <div
                    className={
                      r.extraction.unreadable_text.length > 0
                        ? "text-brand-amber text-right"
                        : "text-white/70 text-right"
                    }
                  >
                    {r.extraction.unreadable_text.length}
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-white/5 text-[10px] font-mono text-white/30 uppercase tracking-widest">
                  {formatTime(r.capturedAt)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <StageBoundaryBanner />
      <TelemetryStrip />
    </div>
  );
}