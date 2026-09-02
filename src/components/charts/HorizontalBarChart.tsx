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
  height,
  defaultColor = "var(--series-1)",
}: {
  data: BarDatum[];
  height?: number;
  defaultColor?: string;
}) {
  const rowHeight = 32;
  const chartHeight = height ?? Math.max(120, data.length * rowHeight);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--gridline)", opacity: 0.4 }}
          formatter={(value) => [String(value ?? 0), "Count"]}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-hairline)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color ?? defaultColor} />
          ))}
          <LabelList dataKey="count" position="right" style={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
