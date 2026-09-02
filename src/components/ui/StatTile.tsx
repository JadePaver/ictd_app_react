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
        <span className="text-3xl font-semibold tabular-nums text-ink">{displayValue ?? formatCompact(value)}</span>
        {trend && trend.length > 1 ? (
          <div className="mb-1 w-24 shrink-0">
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
