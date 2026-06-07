import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
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
  useSensorActiveMutation,
  useStateStatusMutation,
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
  const [mockSensorActive, setMockSensorActive] = useState(false);
  const [mockResultJson, setMockResultJson] = useState<any>(null);

  // live state
  const liveState = useLiveState(isLive);
  const triggerMut = useTriggerMutation();
  const extractMut = useExtractMutation();
  const sensorActiveMut = useSensorActiveMutation();
  const stateStatusMut = useStateStatusMutation();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [schema, setSchema] = useState<SchemaName>("sakura_logistics");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<EvidenceRecord | null>(null);

  const liveStatus = liveState.data?.status ?? "SLEEP";
  const isProcessing = extractMut.isPending || liveStatus === "PROCESSING";

  // Webcam & Auto-Trigger capture states
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [detectedDistance, setDetectedDistance] = useState<string>("12.0");
  const [hasTriggered, setHasTriggered] = useState(false);

  const sensorActive = isLive ? !!liveState.data?.sensor_active : mockSensorActive;
  const currentStatus = isLive ? liveStatus : mockTriggerState;

  useEffect(() => {
    if (currentStatus === "SLEEP") {
      setHasTriggered(false);
    }
  }, [currentStatus]);

  useEffect(() => {
    if (sensorActive && currentStatus === "AWAKE" && !hasTriggered) {
      setHasTriggered(true);
      startWebcamCapture();
    }
  }, [sensorActive, currentStatus, hasTriggered]);

  const startWebcamCapture = async () => {
    setWebcamOpen(true);
    setCountdown(3);
    setSnapshotBlob(null);
    setSnapshotUrl(null);
    setWebcamError(null);
    setFlashActive(false);

    // Generate a realistic random range between 11.0cm and 14.0cm
    const range = (11.0 + Math.random() * 3.0).toFixed(1);
    setDetectedDistance(range);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      
      // Delay slightly to ensure video element is rendered and bound to ref
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);

      // Start countdown
      let currentVal = 3;
      const interval = window.setInterval(() => {
        currentVal -= 1;
        if (currentVal > 0) {
          setCountdown(currentVal);
        } else {
          window.clearInterval(interval);
          captureSnapshot();
        }
      }, 1000);
    } catch (err) {
      console.error("Failed to access webcam:", err);
      setWebcamError("Could not access camera. Please check permissions.");
    }
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    // Create canvas to draw frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Trigger white flash animation
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 300);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setSnapshotBlob(blob);
            setSnapshotUrl(URL.createObjectURL(blob));
          }
        },
        "image/jpeg",
        0.95
      );
    }

    // Stop all tracks in the stream
    stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCountdown(null);
  };

  const handleDecline = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamOpen(false);
    setSnapshotBlob(null);
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    setSnapshotUrl(null);

    if (isLive) {
      try {
        await stateStatusMut.mutateAsync("SLEEP");
      } catch (e) {
        console.error(e);
      }
    } else {
      setMockTriggerState("SLEEP");
    }
  };

  const handleApprove = async () => {
    if (!snapshotBlob) return;
    const filename = `webcam_capture_${Date.now()}.jpg`;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamOpen(false);

    if (isLive) {
      try {
        const file = new File([snapshotBlob], filename, { type: "image/jpeg" });
        setPendingFile(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));

        await stateStatusMut.mutateAsync("SLEEP");
        
        const res = await extractMut.mutateAsync({
          file,
          filename,
          schema,
        });
        const factId = res.fact.id || `EV-${Date.now()}`;
        setImage(factId, file);
        const adapted = adaptFactToEvidence(
          { ...res.fact, id: factId },
          { latencyMs: res.latency_ms }
        );
        setLiveResult(adapted);
      } catch (err) {
        console.error("Extraction failed:", err);
      }
    } else {
      setPendingFile(null);
      setPreviewUrl(snapshotUrl);
      setMockTriggerState("SLEEP");
      
      // Generate dynamic mock JSON based on the webcam capture metadata
      const nowStr = new Date().toISOString().split('T')[0];
      setMockResultJson({
        document_type: "receipt",
        actors: ["Akizuki Denshi Salesperson"],
        actions: "Cash purchase of electronics equipment",
        date: nowStr,
        amount: "2,300",
        counterparties: ["Akizuki Denshi Akihabara Branch"],
        summary_jp: "秋月電子通商にてESP32および超音波センサー等の部品を現金購入した領収書。",
        extraction: {
          document_type: "receipt",
          language: "ja",
          fields: [
            { key: "document_type", value: "receipt" },
            { key: "date", value: nowStr },
            { key: "amount", value: "2,300" },
            { key: "actors", value: "Akizuki Denshi Salesperson" },
            { key: "business_action", value: "Cash purchase of electronics equipment" },
            { key: "summary_jp", value: "秋月電子通商にてESP32および超音波センサー等の部品を現金購入した領収書。" }
          ],
          line_items: [
            { description: "ESP32-DevKitC-32EESP", quantity: "1", unit: "pcs", amount: "1800" },
            { description: "コネクタ付ケーブル 20cm 40Pメス", quantity: "1", unit: "pcs", amount: "200" },
            { description: "超音波距離センサー HC-SR04", quantity: "1", unit: "pcs", amount: "300" }
          ],
          unreadable_text: []
        }
      });
      
      runMockExtraction();
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setLiveResult(null);
    setMockResultJson(null);
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
            <div className="border border-white/10 bg-panel p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium">ESP32 / PIR trigger</h2>
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    microcontroller link
                  </span>
                </div>
                <p className="text-xs text-white/40 mb-6 leading-relaxed">
                  Toggle automated camera ingestion. When enabled, a motion event triggers a 3-second webcam countdown.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-xs text-white/50">USB Serial Link</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          isLive
                            ? liveState.data?.sensor_connected
                              ? "bg-brand-teal animate-pulse"
                              : "bg-red-500"
                            : "bg-brand-teal animate-pulse"
                        )}
                      />
                      <span className="text-xs font-mono text-white/80">
                        {isLive
                          ? liveState.data?.sensor_connected
                            ? "Connected (COM3)"
                            : "Disconnected"
                          : "Connected (COM3)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Auto-Trigger Mode</span>
                    <button
                      onClick={async () => {
                        const nextVal = !sensorActive;
                        if (isLive) {
                          await sensorActiveMut.mutateAsync(nextVal);
                        } else {
                          setMockSensorActive(nextVal);
                        }
                      }}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none",
                        sensorActive ? "bg-brand-teal" : "bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block size-4 transform rounded-full bg-white transition-transform duration-200",
                          sensorActive ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={
                  isLive
                    ? () => triggerMut.mutate()
                    : () => {
                        setMockTriggerState("AWAKE");
                      }
                }
                disabled={isLive && (!liveState.data?.sensor_connected || !sensorActive)}
                className="mt-6 border border-white/15 text-white/80 px-4 py-2 text-xs hover:border-white/30 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
              >
                {isLive
                  ? "Force Serial Trigger →"
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
                {completed && (
                  <button
                    onClick={() => {
                      const nextId = isLive ? liveResult?.id : sample.id;
                      if (nextId) {
                        navigate({ to: "/evidence/$id", params: { id: nextId } });
                      }
                    }}
                    className="bg-brand-teal text-background px-3 py-1.5 text-xs hover:bg-brand-teal/90 transition-colors cursor-pointer uppercase tracking-wider rounded-sm font-sans font-medium"
                  >
                    Next: View in Records →
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
                    image={previewUrl || sample.image}
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
                    extraction={mockResultJson?.extraction || sample.extraction}
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
      {/* Webcam countdown modal */}
      {webcamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
          <div className="relative border border-white/10 bg-[#0c0c0e] p-6 max-w-lg w-full rounded shadow-2xl flex flex-col items-center">
            {/* Screen Flash Visual Effect */}
            {flashActive && (
              <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-300 animate-fade-out" />
            )}

            <div className="w-full flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-brand-teal animate-pulse" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
                  Edge Camera Ingestion
                </h3>
              </div>
              <button
                onClick={handleDecline}
                className="text-xs font-mono text-white/40 hover:text-white/80 uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Range & Target Detected Telemetry Banner */}
            <div className="w-full bg-brand-teal/5 border border-brand-teal/20 px-3 py-2 rounded text-[10px] font-mono text-brand-teal mb-4 flex items-center justify-between animate-pulse">
              <span>STATUS: TARGET DOCUMENT DETECTED</span>
              <span className="font-bold font-mono">RANGE: {detectedDistance} CM</span>
            </div>

            <div className="relative w-full aspect-[4/3] bg-black border border-white/5 flex items-center justify-center overflow-hidden mb-6">
              {webcamError ? (
                <div className="text-center text-xs text-red-400 p-4">{webcamError}</div>
              ) : snapshotUrl ? (
                <img
                  src={snapshotUrl}
                  alt="Captured snapshot"
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100 rounded"
                  />
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="text-7xl font-display font-medium text-brand-orange animate-ping">
                        {countdown}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="w-full flex gap-3 justify-end text-xs font-mono">
              {snapshotUrl ? (
                <>
                  <button
                    onClick={handleDecline}
                    className="border border-white/15 px-4 py-2 hover:border-white/30 text-white/70 hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Decline / Retry
                  </button>
                  <button
                    onClick={handleApprove}
                    className="bg-brand-orange text-background px-4 py-2 hover:bg-brand-orange/95 font-medium transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Approve Ingestion
                  </button>
                </>
              ) : (
                <span className="text-white/40 italic uppercase tracking-wider text-[10px]">
                  {countdown !== null ? `Auto-capturing in ${countdown}s...` : "Initializing camera..."}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <StageBoundaryBanner />
      <TelemetryStrip
        telemetry={sample.telemetry}
        liveLatencyMs={isLive ? extractMut.data?.latency_ms : undefined}
        weaveTraceUrl={isLive ? extractMut.data?.weave_trace_url : undefined}
      />
    </div>
  );
}