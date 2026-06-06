import type { EvidenceRecord } from "@/mocks/evidence";
import { useDataSource } from "@/lib/advent-one/source";

type Telemetry = EvidenceRecord["telemetry"];

export function TelemetryStrip({
  telemetry,
  liveLatencyMs,
  weaveTraceUrl,
}: {
  telemetry?: Partial<Telemetry>;
  liveLatencyMs?: number;
  weaveTraceUrl?: string;
}) {
  const { mode } = useDataSource();
  const isLive = mode === "live";

  const t: Telemetry = {
    backend: "mtmd_cli",
    model: "LFM2.5-VL Extract",
    mode: "local",
    n_gpu_layers: 0,
    latency_sec: "sample",
    tokens_per_sec: "sample",
    rss_mb: "sample",
    ...telemetry,
  };

  const Item = ({
    label,
    value,
    sample,
  }: {
    label: string;
    value: string | number;
    sample?: boolean;
  }) => (
    <div className="flex items-center gap-1.5 font-mono text-[10px]">
      <span className="text-white/20">{label}</span>
      <span className={sample ? "text-brand-amber" : "text-white/70"}>{value}</span>
    </div>
  );

  return (
    <div className="h-12 bg-background flex items-center px-8 justify-between border-t border-white/5">
      <div className="text-[10px] font-mono text-white/30 uppercase tracking-tighter">
        {isLive
          ? liveLatencyMs !== undefined
            ? "Telemetry — backend-reported latency."
            : "Telemetry — awaiting backend response."
          : "Telemetry preview — mock data; no real benchmarks."}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <Item label="backend" value={t.backend} />
        <Item label="model" value={t.model} />
        <Item label="mode" value={t.mode} />
        <Item label="n_gpu_layers" value={t.n_gpu_layers} />
        {isLive && liveLatencyMs !== undefined ? (
          <Item label="latency_ms" value={liveLatencyMs.toFixed(0)} />
        ) : (
          <Item label="latency" value={`~${t.latency_sec}`} sample={!isLive} />
        )}
        {!isLive && (
          <>
            <Item label="tok/s" value={`~${t.tokens_per_sec}`} sample />
            <Item label="RSS" value={`~${t.rss_mb} MB`} sample />
          </>
        )}
        {weaveTraceUrl && (
          <a
            href={weaveTraceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-brand-teal hover:underline"
          >
            weave trace →
          </a>
        )}
      </div>
    </div>
  );
}