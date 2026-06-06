import { createFileRoute, Link } from "@tanstack/react-router";
import { getEvidenceById, type EvidenceRecord } from "@/mocks/evidence";
import { JsonViewer } from "@/components/json-viewer";
import { DocumentViewer } from "@/components/document-viewer";
import { StageBoundaryBanner } from "@/components/stage-banner";
import { TelemetryStrip } from "@/components/telemetry-strip";
import { useDataSource } from "@/lib/advent-one/source";
import { useLiveFacts } from "@/lib/advent-one/queries";
import { adaptFactToEvidence } from "@/lib/advent-one/adapters";

export const Route = createFileRoute("/evidence/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `RollupOS — ${params.id}` },
      { name: "description", content: "Single Stage 1 evidence record with schema-bound JSON." },
    ],
  }),
  // No loader: we resolve mock vs live in the component to avoid SSR fetches.
  notFoundComponent: () => (
    <div className="h-full flex items-center justify-center text-sm text-white/50">
      Evidence record not found.
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="h-full flex items-center justify-center flex-col gap-4">
      <p className="text-sm text-white/70">Couldn't load this record.</p>
      <button onClick={reset} className="text-xs font-mono text-brand-orange uppercase">
        Retry
      </button>
      <p className="text-[10px] text-white/30 font-mono">{String((error as Error).message)}</p>
    </div>
  ),
  component: EvidenceDetail,
});

function EvidenceDetail() {
  const { id } = Route.useParams();
  const { mode } = useDataSource();
  const isLive = mode === "live";
  const facts = useLiveFacts(isLive);

  let record: EvidenceRecord | undefined;
  if (isLive) {
    const f = facts.data?.find((x) => x.id === id);
    record = f ? adaptFactToEvidence(f) : undefined;
  } else {
    record = getEvidenceById(id);
  }

  if (!record) {
    if (isLive && facts.isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-xs font-mono text-white/40 uppercase tracking-widest">
          loading…
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-white/60">Evidence record {id} not found.</p>
        <Link to="/evidence" className="text-xs font-mono text-brand-orange uppercase tracking-widest hover:underline">
          ← Back to evidence
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <main className="flex-1 flex min-h-0">
        {/* Left: source document */}
        <section className="w-[56%] overflow-y-auto p-12 border-r border-white/5">
          <nav className="mb-8 flex items-center gap-2 text-xs font-mono text-white/30 uppercase tracking-widest">
            <Link to="/evidence" className="hover:text-white/60">
              Evidence
            </Link>
            <span>/</span>
            <span className="text-white/60">
              {record.id} · {record.extraction.document_type}
            </span>
          </nav>

          <h2 className="font-display text-4xl font-medium text-balance mb-2 max-w-[30ch] leading-tight">
            {record.title}
          </h2>
          <p className="text-[11px] font-mono text-white/30 uppercase tracking-widest mb-10">
            captured {new Date(record.capturedAt).toISOString().slice(0, 16).replace("T", " · ")} JST ·
            source: {record.source}
          </p>

          <DocumentViewer image={record.image} unreadable={record.extraction.unreadable_text} />

          {record.extraction.unreadable_text.length > 0 && (
            <div className="mt-8 border-t border-white/5 pt-6">
              <div className="text-[10px] font-mono text-brand-amber uppercase tracking-widest mb-3">
                {record.extraction.unreadable_text.length} unreadable region
                {record.extraction.unreadable_text.length === 1 ? "" : "s"}
              </div>
              <ul className="space-y-2 text-xs text-white/60">
                {record.extraction.unreadable_text.map((u, i) => (
                  <li key={i} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                    <span>{u.region_or_label}</span>
                    <span className="font-mono text-brand-amber">{u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Right: JSON */}
        <section className="w-[44%] min-h-0 flex flex-col">
          <JsonViewer extraction={record.extraction} animate />
        </section>
      </main>
      <StageBoundaryBanner />
      <TelemetryStrip telemetry={record.telemetry} />
    </div>
  );
}