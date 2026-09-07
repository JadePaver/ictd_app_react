import { Line, LineChart, ResponsiveContainer } from "recharts";

/**
 * Stat-tile trend sparkline: de-emphasized, no axes or tooltip (see
 * marks-and-anatomy.md).
 *
 * Hidden from assistive tech on purpose. It carries no value a reader can
 * act on, and the tile's number and hint sit right beside it; announcing an
 * unlabelled graphic after every KPI would be noise.
 */
export function Sparkline({ data, color = "var(--series-1)" }: { data: number[]; color?: string }) {
  const points = data.map((count, i) => ({ i, count }));
  return (
    // The wrapper carries `aria-hidden`: ResponsiveContainer renders its own
    // div and does not forward arbitrary attributes onto it.
    <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={32}>
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
