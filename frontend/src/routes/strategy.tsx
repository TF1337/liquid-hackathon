import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StageBoundaryBanner } from "@/components/stage-banner";
import { TelemetryStrip } from "@/components/telemetry-strip";
import { useDataSource } from "@/lib/advent-one/source";
import { useLiveFacts, useLiveGraph } from "@/lib/advent-one/queries";
import {
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  Compass,
  CheckCircle2,
  FileText,
  FileCheck,
} from "lucide-react";

export const Route = createFileRoute("/strategy")({
  head: () => ({
    meta: [
      { title: "Advent One — Modernization Strategy" },
      { name: "description", content: "M&A Intelligence Strategy: transition from manual chaos to automated digital operations." },
    ],
  }),
  component: StrategyPage,
});

function StrategyPage() {
  const { mode } = useDataSource();
  const isLive = mode === "live";
  const facts = useLiveFacts(isLive);
  const graph = useLiveGraph(isLive);
  const [showPlan, setShowPlan] = useState(false);

  // Derive deal statistics
  const factCount = isLive ? facts.data?.length ?? 0 : 5;
  const hasLiveBottleneck = isLive
    ? !!graph.data?.nodes.some((n) => n.bottleneck || n.founder_dependent)
    : true; // Mock has bottleneck on invoice

  // Calculate mock or live efficiency metrics
  // Base manual speed is represented as a high cost time (e.g. 180 min per dispatch cycle), target is 5 min
  const manualTimeMin = 180;
  const digitalTimeMin = 5;
  const timeSavedPct = Math.round(((manualTimeMin - digitalTimeMin) / manualTimeMin) * 100);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-12 py-12">
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
            Stage 3 · Investment M&amp;A Strategy
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight mb-2">
            Modernization Strategy
          </h1>
          <p className="text-sm text-white/50 max-w-[60ch] leading-relaxed mb-10">
            Strategic M&amp;A operational analysis. Identify manual process overhead, isolate transition deal risks, and formulate the post-acquisition modernization roadmap.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* 1. M&A Efficiency Index */}
            <div className="border border-white/10 bg-panel p-6 flex flex-col items-center text-center">
              <div className="w-full flex items-center justify-between mb-6">
                <h2 className="text-xs font-mono text-white/40 uppercase tracking-wider">
                  M&amp;A Efficiency Index
                </h2>
                <Clock className="size-4 text-brand-teal/80" />
              </div>

              {/* Gauge */}
              <div className="relative size-36 flex items-center justify-center mb-4">
                <svg className="size-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-white/5"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-brand-teal transition-all duration-1000"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - timeSavedPct / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-display font-medium text-white">
                    {timeSavedPct}%
                  </span>
                  <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
                    Time Saved
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full border-t border-white/5 pt-4 text-left">
                <div>
                  <div className="text-[10px] font-mono text-white/30 uppercase">Analog Latency</div>
                  <div className="text-lg font-medium text-white/80 mt-1">{manualTimeMin} min</div>
                  <span className="text-[9px] text-white/40">Manual paper routing</span>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-white/30 uppercase">Digital Target</div>
                  <div className="text-lg font-medium text-brand-teal mt-1">{digitalTimeMin} min</div>
                  <span className="text-[9px] text-brand-teal/60">Edge Vision Copilot</span>
                </div>
              </div>
            </div>

            {/* 2. Bottleneck Heatmap */}
            <div className="lg:col-span-2 border border-white/10 bg-panel p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono text-white/40 uppercase tracking-wider">
                  Bottleneck Heatmap &amp; Diligence Risks
                </h2>
                <AlertTriangle className="size-4 text-brand-amber/80" />
              </div>

              <div className="space-y-3 flex-1 mb-6">
                {hasLiveBottleneck ? (
                  <div className="flex items-start gap-3 p-3 bg-red-950/20 border border-red-500/30 rounded text-red-200">
                    <AlertTriangle className="size-4 mt-0.5 text-red-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        CRITICAL RISK: Founder Signature Gate
                      </div>
                      <p className="text-[11px] text-red-200/70 mt-1 leading-relaxed">
                        President Yoshimura must verbally confirm or physically sign invoices and dispatch logs. The business cannot transition cleanly without digitalizing this workflow layer.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/10 rounded text-white/70">
                    <CheckCircle2 className="size-4 mt-0.5 text-brand-teal shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        Primary Bottlenecks Resolved
                      </div>
                      <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
                        No critical key-person approvals are bottlenecking active operational routes.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/10 rounded text-white/70">
                  <FileText className="size-4 mt-0.5 text-brand-amber shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      HIGH RISK: Unstructured Pen &amp; Paper Ingestion
                    </div>
                    <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
                      Operator temperature readings and delivery logs are filed in cardboard boxes daily, preventing real-time safety compliance and retroactive database audits.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowPlan((p) => !p)}
                className="w-full bg-brand-orange text-background hover:bg-brand-orange/95 transition-colors py-2 px-4 text-xs font-medium uppercase tracking-wider cursor-pointer"
              >
                {showPlan ? "Hide Remediation Plan" : "Generate Remediation Plan"}
              </button>
            </div>
          </div>

          {/* Remediation Plan Box */}
          {showPlan && (
            <div className="border border-brand-teal/30 bg-panel/50 p-6 mb-8 rounded tw-animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="size-5 text-brand-teal" />
                <h3 className="font-display text-lg font-medium text-white">
                  M&amp;A Post-Acquisition Remediation Strategy
                </h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-xs text-white/70 leading-relaxed">
                <div>
                  <h4 className="font-bold text-white mb-2 uppercase tracking-wide">
                    1. Eliminating Key-Person Gateways
                  </h4>
                  <p className="text-white/50 mb-4">
                    Deploy local tablet clients with standard schemas to loading dock personnel. Re-route verbal confirmations into automated Slack/Teams Webhooks directly validating vendor amounts against matching PO documents.
                  </p>
                  <h4 className="font-bold text-white mb-2 uppercase tracking-wide">
                    2. Local Edge Infrastructure Savings
                  </h4>
                  <p className="text-white/50">
                    By installing the local `LFM2.5-VL` vision extractor directly on the appliance, marginal document transaction cost drops to <strong>¥0</strong>. The platform works 100% offline, preserving absolute privacy and avoiding cloud leaks under M&amp;A diligence NDAs.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-2 uppercase tracking-wide">
                    3. Estimated Valuation Multiplier Impact
                  </h4>
                  <ul className="space-y-3 text-white/50 mb-6">
                    <li className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span>Operational Hand-off Latency</span>
                      <span className="text-brand-teal font-mono font-medium">Reduced 97%</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span>Diligence Audit Trail Quality</span>
                      <span className="text-brand-teal font-mono font-medium">100% Grounded</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Valuation Risk Discount (Post-Cleanup)</span>
                      <span className="text-brand-teal font-mono font-medium">Cleared (0%)</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-2 uppercase tracking-wide">
                    4. Post-Modernization worth &amp; Valuation
                  </h4>
                  <ul className="space-y-3 text-white/50">
                    <li className="border-b border-white/5 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span>Pre-Acquisition (Analog)</span>
                        <span className="text-red-400 font-mono font-medium">¥350M</span>
                      </div>
                      <p className="text-[10px] text-white/30 leading-normal">
                        Valued at 4.0x EBITDA due to owner-dependencies, unstructured paper logs, and high transaction latency.
                      </p>
                    </li>
                    <li className="border-b border-white/5 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span>Post-Acquisition (Digitalized)</span>
                        <span className="text-brand-teal font-mono font-medium">¥525M</span>
                      </div>
                      <p className="text-[10px] text-brand-teal/50 leading-normal">
                        Valued at 6.0x EBITDA by implementing on-device vision ingestion, resolving the key-person discount.
                      </p>
                    </li>
                    <li className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-white/80">Valuation Expansion</span>
                      <span className="text-brand-orange font-mono font-bold">+¥175M (+50%)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 3. Modernization Roadmap */}
          <div className="border border-white/10 bg-panel p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl font-medium">Modernization Roadmap</h2>
                <p className="text-xs text-white/40 mt-1">
                  Transition from manual analog chaos to strategic digital M&amp;A intelligence.
                </p>
              </div>
              <Compass className="size-5 text-brand-orange/80" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="flex flex-col p-4 bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-[10px] font-mono text-brand-orange uppercase tracking-wider mb-2">
                  Step 01
                </div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">
                  Digitize Manual Logs
                </h3>
                <p className="text-[11px] text-white/40 leading-relaxed flex-1">
                  Eliminate hand-written paper logs. Ingest files using local vision model extractor (`LFM2.5-VL`).
                </p>
                <div className="mt-4 text-[9px] font-mono text-brand-teal uppercase tracking-widest bg-brand-teal/5 border border-brand-teal/10 px-1.5 py-0.5 text-center">
                  Before: Analog Log
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col p-4 bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-[10px] font-mono text-brand-orange uppercase tracking-wider mb-2">
                  Step 02
                </div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">
                  Automate Approvals
                </h3>
                <p className="text-[11px] text-white/40 leading-relaxed flex-1">
                  Convert verbal sign-offs (sticky notes) to digital Pydantic facts. Route warnings to dashboards instantly.
                </p>
                <div className="mt-4 text-[9px] font-mono text-brand-teal uppercase tracking-widest bg-brand-teal/5 border border-brand-teal/10 px-1.5 py-0.5 text-center">
                  Before: Owner Verbal
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col p-4 bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-[10px] font-mono text-brand-orange uppercase tracking-wider mb-2">
                  Step 03
                </div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">
                  Graph Synthesis
                </h3>
                <p className="text-[11px] text-white/40 leading-relaxed flex-1">
                  Aggregate extracted records. Reconstruct observed workflows deterministically to visualize real dependencies.
                </p>
                <div className="mt-4 text-[9px] font-mono text-brand-teal uppercase tracking-widest bg-brand-teal/5 border border-brand-teal/10 px-1.5 py-0.5 text-center">
                  Before: Disconnected paper
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col p-4 bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors">
                <div className="text-[10px] font-mono text-brand-orange uppercase tracking-wider mb-2">
                  Step 04
                </div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">
                  Clear Diligence Audit
                </h3>
                <p className="text-[11px] text-white/40 leading-relaxed flex-1">
                  Clean up operational risk factors. Maximize transition valuation during M&amp;A negotiations.
                </p>
                <div className="mt-4 text-[9px] font-mono text-brand-teal uppercase tracking-widest bg-brand-teal/5 border border-brand-teal/10 px-1.5 py-0.5 text-center">
                  After: Digital Diligence
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <StageBoundaryBanner />
      <TelemetryStrip />
    </div>
  );
}
