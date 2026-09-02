import { mrItemLabel } from "../../lib/mrMetrics";
import { formatDate, formatDays } from "../../lib/format";
import type { MemorandumReceiptDetail } from "../../types/api";

/** Bottom edge torn off a pad — a fixed-tooth sawtooth via `clip-path`,
 * expressed entirely in percentages so it scales with whatever width the
 * card renders at. `mask-image` gradients could fake the same "punched
 * paper" look but need a `-webkit-` prefix and a background color that
 * exactly matches whatever sits behind the card (fragile under this app's
 * translucent, blurred modal backdrop); a polygon clip has neither problem. */
function tornEdgeClipPath(teeth: number): string {
  const points = ["0% 0%", "100% 0%", "100% 94%"];
  for (let i = 0; i <= teeth; i++) {
    const x = 100 - (i / teeth) * 100;
    points.push(`${x}% 94%`);
    if (i < teeth) points.push(`${100 - ((i + 0.5) / teeth) * 100}% 100%`);
  }
  points.push("0% 94%");
  return `polygon(${points.join(", ")})`;
}

/** Deterministic decorative barcode — bar widths derived from the MR
 * number's own characters, so each receipt's barcode is stable and unique
 * to it rather than random-per-render, without pretending to be scannable. */
function BarcodeStrip({ seed }: { seed: string }) {
  const bars = [...seed].map((ch) => (ch.charCodeAt(0) % 3) + 1);
  return (
    <div className="flex h-6 items-stretch gap-[2px]" aria-hidden="true">
      {bars.map((w, i) => (
        <div key={i} className="bg-black/70" style={{ width: `${w}px` }} />
      ))}
    </div>
  );
}

const divider = "border-t border-dashed border-black/20";

/**
 * A memorandum receipt is a physical paper form, not a database record —
 * everywhere else in this feature (the ledger, the detail shell, the issue/
 * transfer forms) is legitimately a data UI, but the receipt *itself*
 * deserves to look like the object it's named after: narrow, off-white,
 * torn off a pad, monospace line items, a stamp for what's wrong with it.
 * Used both in MrDetailModal (the on-screen record) and MrPrintModal's
 * preview (what's about to print), so the two never drift apart.
 *
 * Deliberately monochrome — urgency is communicated only by the overdue
 * stamp, not by mixing in the app's own status colors, so it still reads
 * as ink on paper rather than another themed UI panel.
 */
export function MrReceiptCard({ mr, className }: { mr: MemorandumReceiptDetail; className?: string }) {
  const isOverdue = mr.status === "active" && !!mr.expected_return_at && new Date(mr.expected_return_at) < new Date();
  const isClosed = mr.status === "returned" || mr.status === "transferred";
  const openDays = (() => {
    const from = new Date(mr.issued_at).getTime();
    const to = new Date(mr.returned_at ?? new Date().toISOString()).getTime();
    return Number.isNaN(from) || Number.isNaN(to) || to < from ? null : (to - from) / 86_400_000;
  })();

  return (
    <div className={`relative ${className ?? ""}`}>
      {isOverdue ? (
        <div
          className="pointer-events-none absolute top-3 right-3 z-10 rotate-[-9deg] rounded border-[3px] border-red-600/70 px-2 py-0.5 font-mono text-[11px] font-black tracking-widest text-red-600/70"
          aria-hidden="true"
        >
          OVERDUE
        </div>
      ) : null}

      <div
        className="relative overflow-hidden bg-[#fdfbf3] px-5 pt-5 pb-7 text-black shadow-lg"
        style={{ clipPath: tornEdgeClipPath(14) }}
      >
        {isClosed ? (
          <p
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] font-mono text-3xl font-black tracking-[0.2em] text-black/[0.06] select-none"
            aria-hidden="true"
          >
            {mr.status === "returned" ? "RETURNED" : "TRANSFERRED"}
          </p>
        ) : null}

        <div className="relative flex flex-col items-center text-center">
          <p className="font-serif text-sm font-bold tracking-[0.15em]">MEMORANDUM RECEIPT</p>
          <p className="mt-0.5 font-mono text-xs font-bold text-black/60">{mr.mr_number}</p>
        </div>

        <div className={`relative mt-3 pt-3 ${divider}`}>
          <p className="text-[9px] font-bold tracking-widest text-black/40 uppercase">Custodian</p>
          <p className="text-sm font-semibold">
            {[mr.custodian?.first_name, mr.custodian?.last_name].filter(Boolean).join(" ") || "Unassigned"}
          </p>
          <p className="text-[11px] text-black/50">
            {[mr.custodian?.employee_number ? `#${mr.custodian.employee_number}` : null, mr.departments?.label]
              .filter(Boolean)
              .join(" · ") || " "}
          </p>
        </div>

        <div className={`relative mt-3 flex justify-between pt-3 text-[11px] ${divider}`}>
          <div>
            <p className="font-bold tracking-widest text-black/40 uppercase">Issued</p>
            <p className="font-mono">{formatDate(mr.issued_at)}</p>
          </div>
          <div className="text-right">
            <p className="font-bold tracking-widest text-black/40 uppercase">Due</p>
            <p className="font-mono">{mr.expected_return_at ? formatDate(mr.expected_return_at) : "—"}</p>
          </div>
        </div>

        <div className={`relative mt-3 pt-3 ${divider}`}>
          <p className="mb-1.5 text-[9px] font-bold tracking-widest text-black/40 uppercase">
            {mr.items.length} item{mr.items.length === 1 ? "" : "s"}
          </p>
          <ul className="flex flex-col gap-1.5">
            {mr.items.length === 0 ? (
              <li className="font-mono text-xs text-black/40">No items.</li>
            ) : (
              mr.items.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-2 font-mono text-xs">
                  <span className="min-w-0 truncate">{mrItemLabel(entry)}</span>
                  <span className="shrink-0 text-black/40">{entry.status}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {mr.notes ? (
          <div className={`relative mt-3 pt-3 ${divider}`}>
            <p className="text-[9px] font-bold tracking-widest text-black/40 uppercase">Notes</p>
            <p className="text-[11px] whitespace-pre-line text-black/70">{mr.notes}</p>
          </div>
        ) : null}

        <div className={`relative mt-4 flex items-end justify-between pt-3 ${divider}`}>
          <p className="font-mono text-[10px] text-black/40">
            {mr.status === "active" ? "open" : "was open"} {openDays != null ? formatDays(openDays) : "—"}
          </p>
          <BarcodeStrip seed={mr.mr_number || "MR"} />
        </div>
      </div>
    </div>
  );
}
