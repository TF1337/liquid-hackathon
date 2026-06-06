import { useMemo } from "react";
import type { EvidenceExtraction } from "@/mocks/evidence";
import { cn } from "@/lib/utils";

type Line = { kind: "punc" | "kv" | "comment"; indent: number; html: React.ReactNode };

const k = (s: string) => <span className="text-brand-orange">{`"${s}"`}</span>;
const v = (s: string) => <span className="text-brand-teal">{`"${s}"`}</span>;
const reason = (s: string) => <span className="text-brand-amber">{`"${s}"`}</span>;

function buildLines(ex: EvidenceExtraction): Line[] {
  const lines: Line[] = [];
  lines.push({ kind: "punc", indent: 0, html: <span className="text-white/40">{"{"}</span> });
  lines.push({ kind: "kv", indent: 1, html: <>{k("document_type")}: {v(ex.document_type)},</> });
  lines.push({ kind: "kv", indent: 1, html: <>{k("language")}: {v(ex.language)},</> });
  lines.push({ kind: "kv", indent: 1, html: <>{k("fields")}: [</> });
  ex.fields.forEach((f, i) => {
    lines.push({
      kind: "kv",
      indent: 2,
      html: (
        <>
          {"{ "}
          {k("key")}: {v(f.key)}, {k("value")}: {v(f.value)}
          {" }"}
          {i < ex.fields.length - 1 ? "," : ""}
        </>
      ),
    });
  });
  lines.push({ kind: "punc", indent: 1, html: <>],</> });
  lines.push({ kind: "kv", indent: 1, html: <>{k("line_items")}: [</> });
  ex.line_items.forEach((li, i) => {
    lines.push({
      kind: "kv",
      indent: 2,
      html: (
        <>
          {"{ "}
          {k("description")}: {v(li.description)}, {k("quantity")}: {v(li.quantity)}, {k("unit")}: {v(li.unit)}
          {" }"}
          {i < ex.line_items.length - 1 ? "," : ""}
        </>
      ),
    });
  });
  lines.push({ kind: "punc", indent: 1, html: <>],</> });
  lines.push({ kind: "kv", indent: 1, html: <>{k("unreadable_text")}: [</> });
  ex.unreadable_text.forEach((u, i) => {
    lines.push({
      kind: "kv",
      indent: 2,
      html: (
        <>
          {"{ "}
          {k("region_or_label")}: {v(u.region_or_label)}, {k("reason")}: {reason(u.reason)}
          {" }"}
          {i < ex.unreadable_text.length - 1 ? "," : ""}
        </>
      ),
    });
  });
  lines.push({ kind: "punc", indent: 1, html: <>]</> });
  lines.push({ kind: "punc", indent: 0, html: <span className="text-white/40">{"}"}</span> });
  return lines;
}

export function JsonViewer({
  extraction,
  animate = false,
  title = "minimal_evidence.schema.json",
}: {
  extraction: EvidenceExtraction;
  animate?: boolean;
  title?: string;
}) {
  const lines = useMemo(() => buildLines(extraction), [extraction]);

  return (
    <section className="flex flex-col bg-background h-full min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/30">
          {title}
        </div>
        <button
          onClick={() => {
            try {
              navigator.clipboard.writeText(JSON.stringify(extraction, null, 2));
            } catch {
              /* ignore */
            }
          }}
          className="text-[10px] font-mono text-brand-orange uppercase tracking-widest cursor-pointer hover:text-brand-orange/70 transition-colors"
        >
          Copy JSON
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={i}
                className={cn(animate && "animate-stream-line")}
                style={animate ? { animationDelay: `${i * 45}ms` } : undefined}
              >
                <td className="w-8 text-white/10 pr-4 text-right select-none align-top">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td
                  className="text-white/60 align-top"
                  style={{ paddingLeft: `${line.indent * 1.25}rem` }}
                >
                  {line.html}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}