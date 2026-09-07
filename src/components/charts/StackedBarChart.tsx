import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface StackSeries {
  /** Key into each datum's numeric fields. */
  key: string;
  label: string;
  color: string;
}

export interface StackDatum {
  key: string;
  label: string;
  total: number;
  [series: string]: string | number;
}

/** Rounded data-end, square at the baseline. Interior segments stay square. */
function segmentPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (radius <= 0) return `M${x},${y}h${width}v${height}h${-width}Z`;
  return (
    `M${x},${y + radius}` +
    `a${radius},${radius} 0 0 1 ${radius},${-radius}` +
    `h${width - radius * 2}` +
    `a${radius},${radius} 0 0 1 ${radius},${radius}` +
    `v${height - radius}h${-width}Z`
  );
}

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  dataKey?: string;
  payload?: Record<string, number>;
  series?: StackSeries[];
}

/**
 * One stacked segment. Recharts has no notion of the design system's two
 * spacers, so this shape supplies both: a 1px inset top and bottom (which
 * makes a 2px surface gap wherever two segments touch, never a stroke drawn
 * around the mark) and a 4px cap on whichever segment actually ends the
 * column, which isn't always the last series when some of them are zero.
 */
function StackSegment({ x = 0, y = 0, width = 0, height = 0, fill, dataKey, payload, series = [] }: SegmentProps) {
  if (!(height > 0) || !(width > 0)) return null;

  const inset = height > 3 ? 1 : 0;
  const drawHeight = height - inset * 2;
  if (drawHeight <= 0) return null;

  const index = series.findIndex((s) => s.key === dataKey);
  const isCap = index >= 0 && series.slice(index + 1).every((s) => !((payload?.[s.key] ?? 0) > 0));
  const radius = isCap ? Math.min(4, drawHeight, width / 2) : 0;

  return <path d={segmentPath(x, y + inset, width, drawHeight, radius)} fill={fill} />;
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: number;
}

function StackTooltip({
  active,
  payload,
  series,
  labelFor,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  series: StackSeries[];
  labelFor: (datum: StackDatum) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  // Recharts hands every stacked series the same datum; one read is enough.
  const datum = (payload[0] as { payload?: StackDatum }).payload;
  if (!datum) return null;

  return (
    <div className="rounded-lg border border-[color:var(--border-hairline)] bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-ink">{labelFor(datum)}</p>
      <ul className="flex flex-col gap-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-ink-secondary">{s.label}</span>
            <span className="tabular-nums text-ink">{Number(datum[s.key] ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 border-t border-[color:var(--gridline)] pt-1.5 text-ink-secondary">
        Total <span className="font-medium tabular-nums text-ink">{datum.total}</span>
      </p>
    </div>
  );
}

/**
 * Part-to-whole over time. The legend lives outside the plot (rendered by
 * the caller via `StackLegend`) so it can sit in the card header where it
 * reads as a key rather than as chart furniture.
 */
export function StackedBarChart({
  data,
  series,
  width,
  height = 220,
  labelFor,
}: {
  data: StackDatum[];
  series: StackSeries[];
  /** Exact pixel width, which skips the measuring container entirely. Only
   *  for the printed copy of a chart, where the on-screen measurement is
   *  the wrong one. See the print notes in TechnicianReportSheet. Needs a
   *  numeric `height` alongside it. */
  width?: number;
  /** Pass "100%" to fill a flex parent that already has a resolved height. */
  height?: number | `${number}%`;
  /** Tooltip heading for a bucket. The caller knows whether it's a day or a month. */
  labelFor: (datum: StackDatum) => string;
}) {
  // A month of daily buckets is 31 ticks in a card ~600px wide; thin them
  // rather than let them overlap into an unreadable smear.
  const tickInterval = Math.max(0, Math.ceil(data.length / 12) - 1);

  // An array rather than a fragment: recharts finds its axes and bars by
  // walking `children`, and a fragment is one more shape to walk through.
  const marks = [
    <CartesianGrid key="grid" vertical={false} stroke="var(--gridline)" strokeDasharray="0" />,
    <XAxis
      key="x"
      dataKey="label"
      interval={tickInterval}
      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
      axisLine={{ stroke: "var(--baseline)" }}
      tickLine={false}
    />,
    <YAxis
      key="y"
      allowDecimals={false}
      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
      axisLine={false}
      tickLine={false}
      width={36}
    />,
    <Tooltip
      key="tooltip"
      cursor={{ fill: "var(--gridline)", opacity: 0.4 }}
      content={<StackTooltip series={series} labelFor={labelFor} />}
    />,
    ...series.map((s) => (
      <Bar
        key={s.key}
        dataKey={s.key}
        stackId="work"
        fill={s.color}
        maxBarSize={24}
        isAnimationActive={false}
        shape={<StackSegment series={series} />}
      />
    )),
  ];

  // No negative left margin: it claws back padding by sliding the y-axis off
  // the plot, which silently clips the leading digit of any two-figure tick
  // ("16" renders as "6").
  const layout = { data, margin: { top: 8, right: 8, bottom: 0, left: 0 }, barCategoryGap: "18%" };

  if (width != null) {
    return (
      <BarChart {...layout} width={width} height={typeof height === "number" ? height : 220}>
        {marks}
      </BarChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart {...layout}>{marks}</BarChart>
    </ResponsiveContainer>
  );
}

/** Shared key for any chart drawn from a `StackSeries[]`: swatch plus text-token label. */
export function StackLegend({ series, className }: { series: StackSeries[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className ?? ""}`}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="text-xs text-ink-secondary">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}
