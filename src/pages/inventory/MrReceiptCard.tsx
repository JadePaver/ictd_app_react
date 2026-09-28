import clsx from "clsx";
import { daysBetween, isOverdue, mrItemLabel, partAtIssueLabel } from "../../lib/mrMetrics";
import { formatDateMedium, formatDayCount, fullName } from "../../lib/format";
import { lineStatusLabel, officeName } from "../../lib/inventory";
import type { MemorandumReceiptDetail } from "../../types/api";

/** Bottom edge torn off a pad: a fixed-tooth sawtooth via `clip-path`, in
 * percentages so it scales with the card. A polygon clip needs neither a
 * vendor prefix nor a background colour that matches whatever sits behind
 * the card (fragile under the translucent, blurred modal backdrop). */
function tornEdgeClipPath(teeth: number): string {
  const points = ["0% 0%", "100% 0%", "100% 95%"];
  for (let i = 0; i <= teeth; i++) {
    const x = 100 - (i / teeth) * 100;
    points.push(`${x}% 95%`);
    if (i < teeth) points.push(`${100 - ((i + 0.5) / teeth) * 100}% 100%`);
  }
  points.push("0% 95%");
  return `polygon(${points.join(", ")})`;
}

/** Deterministic decorative barcode: bar widths derived from the MR number's
 * own characters, stable and unique to it without pretending to scan. */
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
const label = "text-[9px] font-bold tracking-widest text-black/40 uppercase";

/**
 * A memorandum receipt drawn as the paper form it is: narrow, off-white,
 * torn off a pad, monospace line items, and ink only. Urgency shows as a
 * rubber stamp, closure as a watermark, never as the app's own status
 * colours, so it reads as a document rather than another themed panel.
 * Shared by MrDetailModal and MrPrintModal's preview so they never drift.
 */
export function MrReceiptCard({ mr, className }: { mr: MemorandumReceiptDetail; className?: string }) {
  const overdue = isOverdue(mr);
  const isClosed = mr.status !== "active";
  const openDays = daysBetween(mr.issued_at, mr.returned_at ?? undefined);

  return (
    <div className={clsx("relative", className)}>
      {overdue ? (
        <div
          className="pointer-events-none absolute top-[8.25rem] right-4 z-10 rotate-[-9deg] rounded border-[3px] border-red-600/70 px-2 py-0.5 font-mono text-[11px] font-black tracking-widest text-red-600/75 mix-blend-multiply"
          aria-hidden="true"
        >
          OVERDUE
        </div>
      ) : null}

      <div
        className="relative overflow-hidden bg-[#fdfbf3] px-5 pt-5 pb-8 text-black shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.08)]"
        style={{ clipPath: tornEdgeClipPath(16) }}
      >
        {isClosed ? (
          <p
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[20deg] font-mono text-3xl font-black tracking-[0.2em] text-black/[0.07] select-none"
            aria-hidden="true"
          >
            {mr.status === "returned" ? "RETURNED" : "TRANSFERRED"}
          </p>
        ) : null}

        <div className="relative flex flex-col items-center text-center">
          <p className="font-serif text-sm font-bold tracking-[0.15em]">MEMORANDUM RECEIPT</p>
          <p className="mt-0.5 text-[8px] leading-tight tracking-wider text-balance text-black/45 uppercase">Information &amp; Communications Technology Division</p>
          <p className="mt-1.5 font-mono text-xs font-bold text-black/70">{mr.mr_number}</p>
          {mr.precededBy ? (
            <p className="mt-0.5 font-mono text-[10px] text-black/45">
              {mr.precededBy.kind === "split" ? "split from" : "transferred from"} {mr.precededBy.mr_number}
            </p>
          ) : null}
        </div>

        <div className={clsx("relative mt-3 pt-3", divider)}>
          <p className={label}>Custodian</p>
          <p className="text-sm font-semibold">{fullName(mr.custodian, "Unassigned")}</p>
          <p className="text-[11px] text-black/55">
            {[mr.custodian?.employee_number ? `#${mr.custodian.employee_number}` : null, mr.departments ? officeName(mr.departments) : null]
              .filter(Boolean)
              .join(" · ") || " "}
          </p>
        </div>

        <div className={clsx("relative mt-3 flex justify-between gap-3 pt-3 text-[11px]", divider)}>
          <div>
            <p className={label}>Issued</p>
            <p className="font-mono">{formatDateMedium(mr.issued_at)}</p>
          </div>
          <div className="text-right">
            <p className={label}>Due</p>
            <p className="font-mono">{mr.expected_return_at ? formatDateMedium(mr.expected_return_at) : "No fixed date"}</p>
          </div>
        </div>

        <div className={clsx("relative mt-3 pt-3", divider)}>
          <p className={clsx(label, "mb-1.5")}>
            {mr.items.length} item{mr.items.length === 1 ? "" : "s"}
          </p>
          <ul className="flex flex-col gap-1.5">
            {mr.items.length === 0 ? (
              <li className="font-mono text-xs text-black/40">No items.</li>
            ) : (
              mr.items.map((entry) => (
                <li key={entry.id} className={clsx("font-mono text-xs", entry.status !== "active" && !isClosed && "text-black/40")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">{mrItemLabel(entry)}</span>
                    <span className="shrink-0 text-[10px] text-black/45 lowercase">{lineStatusLabel(entry.status)}</span>
                  </div>
                  <p className="truncate text-[10px] text-black/45">{entry.inventory_items?.serial_number}</p>
                  {entry.partsAtIssue && entry.partsAtIssue.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-0.5 border-l border-dashed border-black/20 pl-2">
                      {entry.partsAtIssue.map((part) => (
                        <li key={part.id} className="truncate text-[10px] text-black/55">
                          ↳ {partAtIssueLabel(part)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.partsChangedSinceIssue ? <p className="mt-0.5 text-[10px] text-black/45 italic">parts changed since issue</p> : null}
                </li>
              ))
            )}
          </ul>
        </div>

        {mr.notes ? (
          <div className={clsx("relative mt-3 pt-3", divider)}>
            <p className={label}>Notes</p>
            <p className="text-[11px] whitespace-pre-line text-black/70">{mr.notes}</p>
          </div>
        ) : null}

        {mr.return_notes ? (
          <div className={clsx("relative mt-3 pt-3", divider)}>
            <p className={label}>Return note</p>
            <p className="text-[11px] whitespace-pre-line text-black/70">{mr.return_notes}</p>
          </div>
        ) : null}

        <div className={clsx("relative mt-4 flex items-end justify-between pt-3", divider)}>
          <p className="font-mono text-[10px] text-black/45">
            {isClosed ? "was open" : "open"} {formatDayCount(openDays)}
          </p>
          <BarcodeStrip seed={mr.mr_number || "MR"} />
        </div>
      </div>
    </div>
  );
}
