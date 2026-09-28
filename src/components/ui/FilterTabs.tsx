import type { ReactNode } from "react";
import clsx from "clsx";

export interface FilterTab<T extends string | number> {
  value: T;
  label: string;
  count?: number;
  /** A colored dot before the label (a status color, say). */
  dot?: string;
  /** Tints the count when it is non-zero and the tab isn't selected, so a
   * waiting "Overdue 2" reads as a problem before anyone clicks it. */
  alert?: "critical" | "warning";
  icon?: ReactNode;
}

/**
 * A row of mutually exclusive filters that also report their counts.
 *
 * - `pills`: compact rounded chips, for secondary filters.
 * - `cards`: small count tiles that double as the page's key numbers, for
 *   the primary segmentation (item status, MR urgency). Scrolls sideways on
 *   narrow screens instead of wrapping into a ragged block.
 */
export function FilterTabs<T extends string | number>({
  tabs,
  value,
  onChange,
  variant = "pills",
  ariaLabel,
}: {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "pills" | "cards";
  ariaLabel: string;
}) {
  if (variant === "cards") {
    return (
      <div role="tablist" aria-label={ariaLabel} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = tab.value === value;
          const alerting = !!tab.alert && !!tab.count;
          return (
            <button
              key={String(tab.value)}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={clsx(
                "flex min-w-[8.5rem] shrink-0 flex-col items-start gap-1 rounded-xl border px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
                active
                  ? "border-series-1/60 bg-series-1/[0.07] shadow-[0_0_0_1px_var(--series-1)]"
                  : "border-[color:var(--border-hairline)] bg-surface hover:border-series-1/30 hover:bg-black/[0.015] dark:hover:bg-white/[0.03]",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
                {tab.dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tab.dot }} /> : null}
                {tab.icon}
                {tab.label}
              </span>
              <span
                className={clsx(
                  "text-xl leading-none font-semibold tabular-nums",
                  alerting && tab.alert === "critical"
                    ? "text-critical"
                    : alerting && tab.alert === "warning"
                      ? "text-[#8a5a00] dark:text-warning"
                      : "text-ink",
                )}
              >
                {tab.count ?? "·"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
      {tabs.map((tab) => {
        const active = tab.value === value;
        const alerting = !!tab.alert && !!tab.count && !active;
        return (
          <button
            key={String(tab.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-series-1 text-white"
                : "border border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
            )}
          >
            {tab.dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tab.dot }} /> : null}
            {tab.icon}
            {tab.label}
            {tab.count != null ? (
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-white/25"
                    : alerting && tab.alert === "critical"
                      ? "bg-critical/15 text-critical"
                      : alerting && tab.alert === "warning"
                        ? "bg-warning/20 text-[#8a5a00] dark:text-warning"
                        : "bg-black/[0.06] dark:bg-white/[0.1]",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
