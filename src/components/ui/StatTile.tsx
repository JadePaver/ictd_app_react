import { Link } from "react-router-dom";
import { Card } from "./Card";
import { Sparkline } from "../charts/Sparkline";
import { ChevronRightIcon } from "./icons";

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/**
 * KPI tile — hero number in ink (never the series color, per the data-viz
 * rules), with the sparkline sitting beside the value rather than below it
 * so the tile reads as one line of fact: "this number, trending like this."
 * Pass `to` to make the whole tile a link into the page that number
 * summarizes — the chevron only fades in on hover so at rest it stays a
 * quiet number, not a button.
 */
export function StatTile({
  label,
  value,
  displayValue,
  hint,
  trend,
  trendColor,
  to,
}: {
  label: string;
  /** Rendered via formatCompact. Ignored when `displayValue` is set — pass 0 as a placeholder in that case. */
  value: number;
  /** Pre-formatted value for non-count metrics (e.g. "4.2 hrs", "1.3 days") that formatCompact can't express. */
  displayValue?: string;
  hint?: string;
  trend?: number[];
  trendColor?: string;
  /** Route this tile summarizes — makes the whole tile a link. */
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-secondary">{label}</span>
        {to ? (
          <ChevronRightIcon size={14} className="shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        {/* Proportional figures, not `tabular-nums`: equal-width digits are
            for columns that must align vertically, and at this size they
            make a number like 121 read loose and gappy. */}
        <span className="text-3xl font-semibold text-ink">{displayValue ?? formatCompact(value)}</span>
        {/* An all-zero series is skipped: it draws a flat rule along the
            baseline that reads as a stray underline rather than as a trend,
            and the "0" beside it already says everything it would. */}
        {trend && trend.length > 1 && trend.some((point) => point !== 0) ? (
          // A pixel width, not `w-24`. The sparkline is a recharts chart
          // that measures this box in JavaScript, and print drops the root
          // font-size, so a rem width would shrink under a measurement the
          // chart has no chance to retake, and the line then prints wider than
          // the tile that holds it. 96px is what `w-24` resolves to on
          // screen, so nothing moves there.
          <div className="mb-1 w-[96px] shrink-0">
            <Sparkline data={trend} color={trendColor} />
          </div>
        ) : null}
      </div>
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1"
      >
        <Card className="flex h-full flex-col gap-1 p-4 transition-[box-shadow,border-color] duration-150 hover:border-series-1/40 hover:shadow-md">
          {body}
        </Card>
      </Link>
    );
  }

  return <Card className="flex h-full flex-col gap-1 p-4">{body}</Card>;
}
