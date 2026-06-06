import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { evidenceRecords } from "@/mocks/evidence";
import { triggerTransitions, type TriggerState } from "@/mocks/hardware";
import { JsonViewer } from "@/components/json-viewer";
import { DocumentViewer } from "@/components/document-viewer";
import { StageBoundaryBanner, BackendErrorBanner } from "@/components/stage-banner";
import { TelemetryStrip } from "@/components/telemetry-strip";
import { useDataSource } from "@/lib/advent-one/source";
import {
  useExtractMutation,
  useTriggerMutation,
  useLiveState,
} from "@/lib/advent-one/queries";
import { adaptFactToEvidence } from "@/lib/advent-one/adapters";
import { setImage } from "@/lib/advent-one/image-store";
import type { EvidenceRecord } from "@/mocks/evidence";
import type { SchemaName } from "@/lib/advent-one/types";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Advent One — Capture & Extract" },
      { name: "description", content: "Manual upload or hardware trigger. Run Stage 1 grounded extraction on a single image." },
    ],
  }),
  component: CapturePage,
});

function CapturePage() {
  const navigate = useNavigate();
  const { mode } = useDataSource();
  const isLive = mode === "live";
  const sample = evidenceRecords[0];

  // mock-only local state
  const [mockTriggerState, setMockTriggerState] = useState<TriggerState>("SLEEP");
  const [mockRunning, setMockRunning] = useState(false);
  const [mockCompleted, setMockCompleted] = useState(false);

  // live state
  const liveState = useLiveState(isLive);
  const triggerMut = useTriggerMutation();
  const extractMut = useExtractMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [schema, setSchema] = useState<SchemaName>("sakura_logistics");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<EvidenceRecord | null>(null);

  const liveStatus = liveState.data?.status ?? "SLEEP";
  const isProcessing = extractMut.isPending || liveStatus === "PROCESSING";

  const handlePickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setLiveResult(null);
    extractMut.reset();
  };

  const runLiveExtraction = async () => {
    if (!pendingFile) {
      handlePickFile();
      return;
    }
    try {
      await triggerMut.mutateAsync();
    } catch {
      /* trigger failure is non-fatal */
    }
    try {
      const res = await extractMut.mutateAsync({
        file: pendingFile,
        filename: pendingFile.name,
        schema,
      });
      const factId = res.fact.id || `EV-${Date.now()}`;
      setImage(factId, pendingFile);
      const adapted = adaptFactToEvidence(
        { ...res.fact, id: factId },
        { latencyMs: res.latency_ms },
      );
      setLiveResult(adapted);
      navigate({ to: "/evidence/$id", params: { id: factId } });
    } catch {
      /* error surfaces in banner */
    }
  };

  const runMockExtraction = () => {
    setMockRunning(true);
    setMockCompleted(false);
    const lc =
      5 +
      sample.extraction.fields.length +
      sample.extraction.line_items.length +
      sample.extraction.unreadable_text.length;
    window.setTimeout(() => {
      setMockRunning(false);
      setMockCompleted(true);
    }, lc * 60 + 400);
  };

  const running = isLive ? isProcessing : mockRunning;
  const completed = isLive ? !!liveResult : mockCompleted;

  const STATES: Array<TriggerState | "PROCESSING"> = isLive
    ? ["SLEEP", "AWAKE", "PROCESSING", "CAPTURE_READY"]
    : ["SLEEP", "AWAKE", "CAPTURE_READY"];

  const activeState: TriggerState | "PROCESSING" = isLive
    ? liveStatus === "READY"
      ? "CAPTURE_READY"
      : liveStatus
    : mockTriggerState;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-12 py-12">
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
            Stage 1 · Capture
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight mb-2">Capture &amp; extract</h1>
          <p className="text-sm text-white/50 max-w-[60ch] leading-relaxed">
            One image in, strict schema-bound JSON out. The hardware trigger is an optional sensor
            layer — capture always falls back to manual upload.
          </p>

          {isLive && extractMut.isError && (
            <div className="mt-6">
              <BackendErrorBanner
                message={(extractMut.error as Error).message}
                status={(extractMut.error as Error & { status?: number }).status}
              />
            </div>
          )}

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual upload */}
            <div className="border border-white/10 bg-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium">Manual upload</h2>
                <span className="text-[10px] font-mono text-brand-teal uppercase tracking-wider">
                  always available
                </span>
              </div>
              <button
                onClick={isLive ? handlePickFile : undefined}
                className={cn(
                  "border border-dashed border-white/15 h-44 w-full flex flex-col items-center justify-center text-center px-6",
                  isLive && "hover:border-white/30 hover:bg-white/[0.02] cursor-pointer transition-colors",
                )}
              >
                <div className="text-sm text-white/60">
                  {isLive
                    ? pendingFile
                      ? `Selected: ${pendingFile.name}`
                      : "Click to select an image"
                    : "Drag-drop or click to select"}
                </div>
                <div className="text-[10px] font-mono text-white/30 mt-2 uppercase tracking-widest">
                  {isLive ? "JPG · PNG" : "JPG · PNG · HEIC (mock)"}
                </div>
              </button>
              {isLive ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileChange}
                  />
                  <div className="mt-4 flex items-center gap-3">
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      Schema
                    </label>
                    <select
                      value={schema}
                      onChange={(e) => setSchema(e.target.value as SchemaName)}
                      className="bg-background border border-white/15 text-xs font-mono text-white/80 px-2 py-1.5 focus:outline-none focus:border-brand-orange"
                    >
                      <option value="sakura_logistics">sakura_logistics</option>
                      <option value="government_letter">government_letter</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="mt-4 text-xs text-white/40">
                  Currently loaded:{" "}
                  <span className="text-white/70 font-mono">
                    {sample.id} · {sample.extraction.document_type}
                  </span>
                </div>
              )}
            </div>

            {/* Hardware trigger */}
            <div className="border border-white/10 bg-panel p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium">ESP32 / PIR trigger</h2>
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  optional · trigger layer
                </span>
              </div>
              <p className="text-xs text-white/40 mb-4 leading-relaxed">
                Updates hardware state only. Does <span className="text-brand-amber">not</span> run
                inference — capture still flows through the extract pipeline below.
              </p>
              <div
                className={cn(
                  "grid gap-2 font-mono text-[10px] uppercase tracking-wider mb-4",
                  STATES.length === 4 ? "grid-cols-4" : "grid-cols-3",
                )}
              >
                {STATES.map((s) => {
                  const isActive = s === activeState;
                  const isProc = s === "PROCESSING";
                  return (
                    <div
                      key={s}
                      className={cn(
                        "py-2 text-center border flex items-center justify-center gap-1.5",
                        isActive && isProc
                          ? "border-brand-amber text-brand-amber bg-brand-amber/5"
                          : isActive
                            ? "border-brand-teal text-brand-teal bg-brand-teal/5"
                            : "border-white/10 text-white/30",
                      )}
                    >
                      {isActive && isProc && (
                        <span className="size-1.5 rounded-full bg-brand-amber animate-pulse" />
                      )}
                      {s}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={
                  isLive
                    ? () => triggerMut.mutate()
                    : () => setMockTriggerState((s) => triggerTransitions[s])
                }
                disabled={isLive && triggerMut.isPending}
                className="mt-auto border border-white/15 text-white/80 px-4 py-2 text-xs hover:border-white/30 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLive
                  ? triggerMut.isPending
                    ? "Triggering…"
                    : "POST /trigger →"
                  : "Trigger sensor event →"}
              </button>
            </div>
          </div>

          {/* Extraction panel */}
          <div className="mt-8 border border-white/10 bg-panel">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-sm font-medium">Extraction</h2>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-1">
                  backend: mtmd_cli · model: LFM2.5-VL Extract
                  {isLive && <span className="text-brand-teal"> · live</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isLive && completed && (
                  <button
                    onClick={() => navigate({ to: "/evidence/$id", params: { id: sample.id } })}
                    className="text-xs font-mono text-brand-teal uppercase tracking-wider hover:underline cursor-pointer"
                  >
                    View record →
                  </button>
                )}
                <button
                  onClick={isLive ? runLiveExtraction : runMockExtraction}
                  disabled={running || (isLive && !pendingFile && !extractMut.isError)}
                  className="bg-brand-orange text-background px-4 py-2 text-xs font-medium hover:bg-brand-orange/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {running
                    ? "Extracting…"
                    : completed
                      ? "Re-run extraction"
                      : isLive && !pendingFile
                        ? "Select an image first"
                        : "Run extraction"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[520px]">
              <div className="p-6 border-r border-white/10">
                <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
                  Source image
                </div>
                {isLive ? (
                  previewUrl ? (
                    <DocumentViewer image={previewUrl} unreadable={[]} />
                  ) : (
                    <div className="aspect-[4/3] border border-dashed border-white/10 flex items-center justify-center text-xs font-mono text-white/30 uppercase tracking-widest">
                      no image selected
                    </div>
                  )
                ) : (
                  <DocumentViewer
                    image={sample.image}
                    unreadable={completed || running ? sample.extraction.unreadable_text : []}
                  />
                )}
              </div>
              <div className="min-h-[520px] flex flex-col">
                {isLive ? (
                  liveResult ? (
                    <JsonViewer extraction={liveResult.extraction} animate />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs font-mono text-white/30 uppercase tracking-widest">
                      {isProcessing ? "Processing on backend…" : "Awaiting extraction…"}
                    </div>
                  )
                ) : running || completed ? (
                  <JsonViewer
                    extraction={sample.extraction}
                    animate={running}
                    key={running ? "run" : "done"}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs font-mono text-white/30 uppercase tracking-widest">
                    Awaiting extraction…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <StageBoundaryBanner />
      <TelemetryStrip
        telemetry={sample.telemetry}
        liveLatencyMs={isLive ? extractMut.data?.latency_ms : undefined}
        weaveTraceUrl={isLive ? extractMut.data?.weave_trace_url : undefined}
      />
    </div>
  );
}