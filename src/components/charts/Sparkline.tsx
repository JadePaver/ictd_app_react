import { Line, LineChart, ResponsiveContainer } from "recharts";

/** Stat-tile trend sparkline — de-emphasized, no axes/tooltip (see marks-and-anatomy.md). */
export function Sparkline({ data, color = "var(--series-1)" }: { data: number[]; color?: string }) {
  const points = data.map((count, i) => ({ i, count }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
