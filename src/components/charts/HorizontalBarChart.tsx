import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  count: number;
  color?: string;
}

/** Magnitude comparison across categories — sequential blue by default (one hue),
 * or a per-bar `color` when the categories carry real identity (e.g. request status). */
export function HorizontalBarChart({
  data,
  width,
  height,
  defaultColor = "var(--series-1)",
}: {
  data: BarDatum[];
  /** Exact pixel width, which skips the measuring container entirely. Only
   *  for the printed copy of a chart, where the on-screen measurement is the
   *  wrong one. See the print notes in TechnicianReportSheet. */
  width?: number;
  height?: number;
  defaultColor?: string;
}) {
  const rowHeight = 32;
  const chartHeight = height ?? Math.max(120, data.length * rowHeight);

  // An array rather than a fragment: recharts finds its axes and bars by
  // walking `children`, and a fragment is one more shape to walk through.
  const marks = [
    <XAxis key="x" type="number" hide />,
    <YAxis
      key="y"
      type="category"
      dataKey="label"
      width={140}
      tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
      axisLine={false}
      tickLine={false}
    />,
    <Tooltip
      key="tooltip"
      cursor={{ fill: "var(--gridline)", opacity: 0.4 }}
      formatter={(value) => [String(value ?? 0), "Count"]}
      contentStyle={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-hairline)",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--text-primary)",
      }}
    />,
    // No grow-in animation. These charts sit on a page whose whole point is
    // being printed, and Chrome relays out (and recharts re-animates) as the
    // print dialog opens: hit Print at the wrong moment and the bars come out
    // half drawn.
    <Bar key="bars" dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
      {data.map((entry, index) => (
        <Cell key={index} fill={entry.color ?? defaultColor} />
      ))}
      <LabelList dataKey="count" position="right" style={{ fill: "var(--text-secondary)", fontSize: 12 }} />
    </Bar>,
  ];

  const layout = {
    data,
    layout: "vertical" as const,
    margin: { top: 4, right: 32, bottom: 4, left: 4 },
    barCategoryGap: 8,
  };

  if (width != null) {
    return (
      <BarChart {...layout} width={width} height={chartHeight}>
        {marks}
      </BarChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart {...layout}>{marks}</BarChart>
    </ResponsiveContainer>
  );
}
