import type { EvidenceUnreadable } from "@/mocks/evidence";

export function DocumentViewer({
  image,
  unreadable,
}: {
  image: string;
  unreadable: EvidenceUnreadable[];
}) {
  return (
    <div className="relative rounded-md overflow-hidden shadow-2xl ring-1 ring-black/40 bg-stone-100">
      <img
        src={image}
        alt="Source document"
        loading="lazy"
        width={1024}
        height={1024}
        className="w-full aspect-[4/5] object-cover"
      />
      {unreadable.map((u, i) =>
        u.bbox ? (
          <div
            key={i}
            className="absolute border border-brand-amber ring-4 ring-brand-amber/5 bg-brand-amber/10 flex items-start p-1.5 group"
            style={{
              left: `${u.bbox[0] * 100}%`,
              top: `${u.bbox[1] * 100}%`,
              width: `${u.bbox[2] * 100}%`,
              height: `${u.bbox[3] * 100}%`,
            }}
          >
            <div className="bg-brand-amber text-[8px] px-1 py-0.5 text-background font-mono font-bold leading-none">
              unreadable: {u.reason}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}