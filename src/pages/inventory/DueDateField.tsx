import clsx from "clsx";
import { FormField, TextInput } from "../../components/ui/FormField";
import { dateInputToDueIso, endOfYearInput, todayPlusDays } from "../../lib/mrMetrics";
import { formatDateMedium } from "../../lib/format";

const PRESETS: { label: string; value: () => string }[] = [
  { label: "1 week", value: () => todayPlusDays(7) },
  { label: "30 days", value: () => todayPlusDays(30) },
  { label: "90 days", value: () => todayPlusDays(90) },
  { label: "End of year", value: endOfYearInput },
];

/**
 * An MR's expected return date: a calendar day, with one-click presets for
 * the usual loan lengths. Blank is a real choice (no fixed date), so the
 * hint spells out what it costs: the MR can then never be flagged.
 */
export function DueDateField({
  id,
  value,
  onChange,
  label = "Expected return",
}: {
  id: string;
  /** YYYY-MM-DD, or "" for no due date. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const iso = value ? dateInputToDueIso(value) : undefined;
  const past = !!iso && new Date(iso).getTime() < Date.now();
  const hint = !value
    ? "Optional. Leave blank for no fixed date; it then can never be flagged due soon or overdue."
    : past
      ? "This date has already passed, so the MR will be overdue as soon as it is issued."
      : `Due back by the end of ${formatDateMedium(iso)}.`;

  return (
    <FormField label={label} htmlFor={id} hint={hint}>
      <TextInput
        type="date"
        className={clsx(past && "border-warning/70 enabled:hover:border-warning")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const presetValue = preset.value();
          const active = presetValue === value;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(presetValue)}
              aria-pressed={active}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-series-1 bg-series-1/10 text-series-1"
                  : "border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
              )}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange("")}
          aria-pressed={!value}
          className={clsx(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            !value
              ? "border-ink-muted/50 bg-black/[0.05] text-ink dark:bg-white/[0.08]"
              : "border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
          )}
        >
          No due date
        </button>
      </div>
    </FormField>
  );
}
