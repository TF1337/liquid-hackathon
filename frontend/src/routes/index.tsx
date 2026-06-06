import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Advent One — Overview" },
      { name: "description", content: "On-device acquisition modernization copilot for under-digitized SMEs. Demo target: Sakura Logistics." },
      { property: "og:title", content: "Advent One — Overview" },
      { property: "og:description", content: "On-device acquisition modernization copilot for under-digitized SMEs." },
    ],
  }),
  component: Index,
});

function Pillar({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="border-t border-white/10 pt-6">
      <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
        {index}
      </div>
      <h3 className="font-display text-xl font-medium mb-3">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{body}</p>
    </div>
  );
}

function Index() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-12 pt-20 pb-16">
        <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-6">
          Current target · Sakura Logistics
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-medium tracking-tight text-balance max-w-[24ch] leading-[1.05]">
          On-device acquisition modernization copilot for under-digitized SMEs.
        </h1>
        <p className="mt-8 text-base text-white/50 max-w-[60ch] leading-relaxed">
          An analyst brings a local AMD Ryzen AI PC appliance to an SME site. Advent One captures
          analog business evidence — invoices, delivery slips, handwritten notes, whiteboards,
          temperature logs — and renders it as strict, schema-bound JSON.
        </p>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/capture"
            className="inline-flex items-center gap-2 bg-brand-orange text-background px-5 py-3 text-sm font-medium hover:bg-brand-orange/90 transition-colors"
          >
            Start demo
            <span aria-hidden>→</span>
          </Link>
          <Link
            to="/evidence"
            className="inline-flex items-center gap-2 border border-white/15 text-white/80 px-5 py-3 text-sm font-medium hover:border-white/30 hover:text-white transition-colors"
          >
            Browse evidence
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-10">
          <Pillar
            index="01"
            title="Local edge inference"
            body="Liquid LFM2.5-VL Extract runs on the local AMD Ryzen AI PC. No cloud round-trip, no third-party model API."
          />
          <Pillar
            index="02"
            title="Deterministic JSON"
            body="The mtmd_cli backend extracts into a strict grammar-bound schema. Every field is auditable against the source image."
          />
          <Pillar
            index="03"
            title="Auditable evidence"
            body="Stage 1 records visible facts only — no bottleneck, ROI, or recommendation inference. Stage 2 aggregates observed signals."
          />
        </div>

        <div className="mt-24 border-t border-white/10 pt-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
          <p className="font-display text-xl text-white/70 italic max-w-[52ch] leading-relaxed">
            “Cloud APIs may be unacceptable under NDA, client confidentiality, and
            data-governance constraints.”
          </p>
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
            Compliance posture
          </div>
        </div>
      </div>
    </div>
  );
}
