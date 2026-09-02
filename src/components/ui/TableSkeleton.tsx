/** Loading placeholder for tables — keeps the header/filters visible and
 * avoids the layout jump of swapping the whole card for a centered spinner. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse divide-y divide-[color:var(--gridline)]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-3.5 flex-1 rounded bg-black/[0.06] dark:bg-white/[0.08]"
              style={c === cols - 1 ? { maxWidth: 24, flexGrow: 0, flexBasis: 24 } : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
