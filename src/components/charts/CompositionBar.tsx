import type { ComponentType } from "react";
import type { StackSeries } from "./StackedBarChart";

export interface CompositionSegment extends StackSeries {
  count: number;
}

type SegmentIcon = ComponentType<{ size?: number; className?: string }>;

/**
 * Part-to-whole for a single total: one horizontal stacked bar plus a keyed
 * readout beneath it.
 *
 * No labels ride *inside* the segments: at four categories, a thin category
 * can be a handful of pixels wide, and a label that doesn't fit gets clipped
 * or overflows. The readout below carries every count and share instead, so
 * nothing is gated behind a hover, and it's what prints.
 *
 * Segments are separated by a 2px gap in the surface color (flex `gap`, not
 * a stroke around each mark).
 */
export function CompositionBar({
  segments,
  icons,
}: {
  segments: CompositionSegment[];
  /** Optional mark per segment key, keyed the same way the segments are.
   *  Sits beside the swatch so the row is identifiable in grayscale print. */
  icons?: Record<string, SegmentIcon>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const present = segments.filter((segment) => segment.count > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* The bar restates the readout below it, so it is decoration as far as
          assistive tech is concerned. */}
      {total > 0 ? (
        <div aria-hidden="true" className="flex h-3 gap-[2px] overflow-hidden rounded-full">
          {present.map((segment) => (
            <div
              key={segment.key}
              // `flexGrow` rather than a percentage width so the 2px gaps come
              // out of the track, not out of the proportions.
              style={{ flexGrow: segment.count, backgroundColor: segment.color }}
              className="first:rounded-l-full last:rounded-r-full"
              role="presentation"
            />
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.07]" />
      )}

      <ul className="flex flex-col gap-1.5">
        {segments.map((segment) => {
          const Icon = icons?.[segment.key];
          return (
          <li key={segment.key} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
            {Icon ? <Icon size={13} className="shrink-0 text-ink-muted" /> : null}
            <span className="min-w-0 flex-1 truncate text-ink-secondary">{segment.label}</span>
            <span className="tabular-nums text-ink">{segment.count}</span>
            <span className="w-11 text-right text-xs tabular-nums text-ink-muted">
              {total > 0 ? `${Math.round((segment.count / total) * 100)}%` : "—"}
            </span>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
