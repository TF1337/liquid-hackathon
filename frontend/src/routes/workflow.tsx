import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { workflowMock } from "@/mocks/workflow";
import { getEvidenceById } from "@/mocks/evidence";
import { StageBoundaryBanner, BackendErrorBanner } from "@/components/stage-banner";
import { TelemetryStrip } from "@/components/telemetry-strip";
import { cn } from "@/lib/utils";
import { useDataSource } from "@/lib/advent-one/source";
import {
  useLiveFacts,
  useLiveGraph,
  useSynthesizeMutation,
} from "@/lib/advent-one/queries";
import {
  adaptFactToEvidence,
  adaptGraphToWorkflow,
} from "@/lib/advent-one/adapters";

export const Route = createFileRoute("/workflow")({
  head: () => ({
    meta: [
      { title: "Advent One — Workflow" },
      { name: "description", content: "Stage 2 aggregation: observed workflow graph reconstructed from Stage 1 records." },
    ],
  }),
  component: WorkflowPage,
});

function WorkflowPage() {
  const { mode } = useDataSource();
  const isLive = mode === "live";
  const facts = useLiveFacts(isLive);
  const graph = useLiveGraph(isLive);
  const synthesizeMut = useSynthesizeMutation();

  const liveAdapted = useMemo(() => {
    if (!isLive || !graph.data) return null;
    return adaptGraphToWorkflow(
      graph.data,
      facts.data?.length ?? 0,
      "Sakura Logistics",
    );
  }, [isLive, graph.data, facts.data]);

  const w = isLive
    ? liveAdapted ?? {
        ...workflowMock,
        workflow_nodes: [],
        workflow_edges: [],
        repeated_manual_paper_signals: [],
        missing_documentation_signals: [],
        document_types_observed: [],
        record_count: facts.data?.length ?? 0,
      }
    : workflowMock;

  const requiresReviewSet = useMemo(
    () =>
      new Set(
        isLive && liveAdapted ? liveAdapted.requires_review_node_ids : [],
      ),
    [isLive, liveAdapted],
  );

  const liveEvidenceById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof adaptFactToEvidence>>();
    if (isLive && facts.data) {
      for (const f of facts.data) {
        const adapted = adaptFactToEvidence(f);
        m.set(adapted.id, adapted);
      }
    }
    return m;
  }, [isLive, facts.data]);

  const lookupEvidence = (eid: string) =>
    isLive ? liveEvidenceById.get(eid) : getEvidenceById(eid);

  const [activeId, setActiveId] = useState<string | null>(null);
  const effectiveActiveId =
    activeId ?? w.workflow_nodes[0]?.id ?? null;
  const active =
    w.workflow_nodes.find((n) => n.id === effectiveActiveId) ?? null;

  const factCount = isLive ? facts.data?.length ?? 0 : workflowMock.record_count;
  const liveGraphMissing = isLive && !graph.data && !graph.isLoading;
  const canGenerate = isLive && liveGraphMissing && factCount >= 3;
  const tooFewFacts = isLive && liveGraphMissing && factCount < 3;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Graph column */}
        <div className="flex-1 min-w-0 overflow-y-auto p-12 border-r border-white/5">
          {isLive && synthesizeMut.isError && (
            <div className="mb-8">
              <BackendErrorBanner
                message={(synthesizeMut.error as Error).message}
                status={(synthesizeMut.error as Error & { status?: number }).status}
              />
            </div>
          )}
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
            Stage 2 · Workflow reconstruction
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight mb-2">
            Observed workflow
          </h1>
          <p className="text-sm text-white/50 max-w-[60ch] leading-relaxed">
            Aggregated from {w.record_count} Stage 1 record{w.record_count === 1 ? "" : "s"}. Each node is grounded in the evidence
            ids it cites — nothing here is inferred beyond what was extracted.
          </p>

          {isLive && (
            <div className="mt-8 flex items-center gap-3">
              {liveAdapted && (
                <button
                  onClick={() => synthesizeMut.mutate()}
                  disabled={synthesizeMut.isPending}
                  className="border border-white/15 text-white/80 px-4 py-2 text-xs hover:border-white/30 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {synthesizeMut.isPending ? "Re-synthesizing…" : "Re-synthesize"}
                </button>
              )}
              {canGenerate && (
                <button
                  onClick={() => synthesizeMut.mutate()}
                  disabled={synthesizeMut.isPending}
                  className="bg-brand-orange text-background px-4 py-2 text-xs font-medium hover:bg-brand-orange/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {synthesizeMut.isPending ? "Generating…" : "Generate workflow →"}
                </button>
              )}
              {tooFewFacts && (
                <div className="text-xs text-white/40 font-mono">
                  Capture at least 3 evidence records to aggregate ({factCount}/3).
                </div>
              )}
            </div>
          )}

          {/* graph */}
          <div className="mt-12 relative">
            {w.workflow_nodes.length === 0 && !canGenerate && !tooFewFacts && (
              <div className="border border-dashed border-white/15 p-12 text-center">
                <p className="text-sm text-white/60">
                  {isLive
                    ? graph.isLoading
                      ? "Loading graph…"
                      : "No workflow synthesized yet."
                    : "No workflow available."}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {w.workflow_nodes.map((n, idx) => {
                const isActive = n.id === effectiveActiveId;
                const needsReview = requiresReviewSet.has(n.id);
                return (
                  <div key={n.id} className="flex items-stretch gap-4">
                    <div className="w-10 flex flex-col items-center pt-4">
                      <div className="text-[10px] font-mono text-white/30">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      {idx < w.workflow_nodes.length - 1 && (
                        <div className="w-px flex-1 bg-white/10 mt-2" />
                      )}
                    </div>
                    <button
                      onClick={() => setActiveId(n.id)}
                      className={cn(
                        "flex-1 text-left border p-5 transition-colors cursor-pointer group",
                        isActive
                          ? "border-brand-orange/60 bg-brand-orange/5"
                          : "border-white/10 bg-panel hover:border-white/25",
                      )}
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="font-display text-xl font-medium">{n.label}</div>
                          <div className="text-xs text-white/40 mt-1">{n.sub}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {needsReview && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 border border-brand-amber/40 text-brand-amber uppercase tracking-wider whitespace-nowrap">
                              requires human review
                            </span>
                          )}
                          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest whitespace-nowrap">
                            {n.evidenceIds.length} record
                            {n.evidenceIds.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {n.manualPaperSignals.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] font-mono px-1.5 py-0.5 border border-brand-amber/30 text-brand-amber/80 uppercase tracking-wider"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-16 text-[11px] font-mono text-brand-teal/70 uppercase tracking-widest border-t border-brand-teal/10 pt-6">
            Stage 2 aggregates extracted records. It does not invent recommendations.
          </p>
        </div>

        {/* Side panel */}
        <aside className="w-[400px] flex-shrink-0 overflow-y-auto p-8 bg-background">
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
            Aggregation
          </div>
          <h2 className="font-display text-2xl font-medium mb-1">{w.target}</h2>
          <div className="text-xs text-white/40 mb-8 font-mono">
            {w.record_count} record{w.record_count === 1 ? "" : "s"} aggregated
          </div>

          {w.document_types_observed.length > 0 && (
            <section className="mb-8">
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
                Document types observed
              </div>
              <ul className="text-xs">
                {w.document_types_observed.map((d) => (
                  <li
                    key={d.type}
                    className="flex justify-between border-b border-white/5 py-2 font-mono"
                  >
                    <span className="text-white/70">{d.type}</span>
                    <span className="text-white/40">×{d.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {w.repeated_manual_paper_signals.length > 0 && (
            <section className="mb-8">
              <div className="text-[10px] font-mono text-brand-amber uppercase tracking-widest mb-3">
                Repeated manual / paper signals
              </div>
              <ul className="text-xs">
                {w.repeated_manual_paper_signals.map((s) => (
                  <li
                    key={s.signal}
                    className="flex justify-between border-b border-white/5 py-2"
                  >
                    <span className="text-white/70">{s.signal}</span>
                    <span className="font-mono text-brand-amber">×{s.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {w.missing_documentation_signals.length > 0 && (
            <section className="mb-8">
              <div className="text-[10px] font-mono text-brand-amber uppercase tracking-widest mb-3">
                Missing documentation signals
              </div>
              <ul className="text-xs space-y-2">
                {w.missing_documentation_signals.map((m) => (
                  <li key={m} className="text-white/60 leading-relaxed pl-3 border-l border-brand-amber/40">
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isLive && liveAdapted && (liveAdapted.workflow_observations_en || liveAdapted.workflow_observations_jp) && (
            <section className="mb-8">
              <div className="text-[10px] font-mono text-brand-teal uppercase tracking-widest mb-3">
                Workflow observations
              </div>
              {liveAdapted.workflow_observations_jp && (
                <p className="text-xs text-white/70 leading-relaxed mb-2">
                  {liveAdapted.workflow_observations_jp}
                </p>
              )}
              {liveAdapted.workflow_observations_en && (
                <p className="text-xs text-white/50 leading-relaxed">
                  {liveAdapted.workflow_observations_en}
                </p>
              )}
            </section>
          )}

          {active && (
            <section>
              <div className="text-[10px] font-mono text-brand-teal uppercase tracking-widest mb-3">
                {active.label} · contributing evidence
              </div>
              <ul className="space-y-2">
                {active.evidenceIds.map((eid) => {
                  const e = lookupEvidence(eid);
                  if (!e) return null;
                  return (
                    <li key={eid}>
                      <Link
                        to="/evidence/$id"
                        params={{ id: eid }}
                        className="flex items-center justify-between border border-white/10 px-3 py-2 text-xs hover:border-brand-teal/50 hover:bg-brand-teal/5 transition-colors"
                      >
                        <span className="font-mono text-white/70">{eid}</span>
                        <span className="text-white/40 truncate ml-3">
                          {e.extraction.document_type}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <StageBoundaryBanner />
      <TelemetryStrip
        liveLatencyMs={isLive ? synthesizeMut.data?.latency_ms : undefined}
        weaveTraceUrl={isLive ? synthesizeMut.data?.weave_trace_url : undefined}
      />
    </div>
  );
}