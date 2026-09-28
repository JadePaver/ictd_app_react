import type { KeyboardEvent } from "react";
import clsx from "clsx";
import { useFieldState } from "../../components/ui/formFieldContext";
import { groupCategories } from "../../lib/inventory";
import { itemStatusTone, toneDotClass } from "../../lib/statusStyles";
import type { ItemCategory, ItemStatusRef } from "../../types/api";
import { CategoryGlyph } from "./InventoryAtoms";

const NEXT_KEYS = ["ArrowRight", "ArrowDown"];
const RADIO_KEYS = [...NEXT_KEYS, "ArrowLeft", "ArrowUp", "Home", "End"];

/** Radio-group keys (WAI-ARIA): the group is one Tab stop, the arrows move
 * and select, Home and End jump to the ends. Locked options are skipped. */
function onRadioKeys(e: KeyboardEvent<HTMLElement>) {
  if (!RADIO_KEYS.includes(e.key)) return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled):not([aria-disabled="true"])')];
  if (radios.length === 0) return;
  e.preventDefault();
  const at = radios.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (at + (NEXT_KEYS.includes(e.key) ? 1 : -1) + radios.length) % radios.length;
  radios[next].focus();
  radios[next].click();
}

/**
 * Category as chips in two groups, Units and Parts (context doc v2, 3.3 and
 * F2). Twelve fixed options read faster as a row of chips than as a menu,
 * and the grouping says up front which items can go inside a PC.
 */
export function CategoryPicker({
  id,
  categories,
  value,
  onChange,
  invalid,
  disabled,
  lockedReason,
}: {
  id: string;
  categories: ItemCategory[];
  value: number | "";
  onChange: (id: number) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Why the category can't change right now (installed part, PC with parts). */
  lockedReason?: string;
}) {
  const field = useFieldState();
  const { units, parts } = groupCategories(categories);
  const locked = disabled || !!lockedReason;
  // The one chip Tab lands on: the chosen category, else the first.
  const tabStop = categories.some((c) => c.id === value) ? value : [...units, ...parts][0]?.id;
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Category"
      aria-invalid={invalid || undefined}
      aria-describedby={field?.messageId}
      onKeyDown={onRadioKeys}
      className="flex flex-col gap-2.5"
    >
      {[
        ["Units", units],
        ["Parts", parts],
      ].map(([label, list]) =>
        (list as ItemCategory[]).length === 0 ? null : (
          <div key={label as string} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{label as string}</span>
            <div className="flex flex-wrap gap-1.5">
              {(list as ItemCategory[]).map((c) => {
                const active = value === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    tabIndex={c.id === tabStop ? 0 : -1}
                    disabled={locked && !active}
                    onClick={() => !locked && onChange(c.id)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-series-1 bg-series-1 text-white"
                        : clsx(
                            "bg-field text-ink-secondary",
                            invalid ? "border-critical/50" : "border-field-line",
                            locked ? "cursor-not-allowed opacity-45" : "hover:border-series-1/40 hover:text-ink",
                          ),
                    )}
                  >
                    <CategoryGlyph code={c.code} size={14} className={active ? "text-white" : "text-ink-muted"} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}
      {lockedReason ? <p className="text-xs text-ink-muted">{lockedReason}</p> : null}
    </div>
  );
}

export interface StatusOption {
  status: ItemStatusRef;
  /** Why this option can't be picked, shown on hover and under the pills. */
  lockedReason?: string;
}

/** Item status as radio pills with the status dot, for the four or five
 * options a form offers. A locked option stays visible and says why. */
export function StatusPills({
  id,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string;
  options: StatusOption[];
  value: number | "";
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const field = useFieldState();
  const tabStop = options.some((o) => o.status.id === value) ? value : options.find((o) => !o.lockedReason)?.status.id;
  return (
    <div id={id} role="radiogroup" aria-label="Status" aria-describedby={field?.messageId} onKeyDown={onRadioKeys} className="flex flex-wrap gap-1.5">
      {options.map(({ status, lockedReason }) => {
        const active = value === status.id;
        const locked = disabled || !!lockedReason;
        return (
          <button
            key={status.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={status.id === tabStop ? 0 : -1}
            aria-disabled={locked && !active}
            title={lockedReason}
            onClick={() => !locked && onChange(status.id)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-ink/70 bg-black/[0.06] text-ink dark:border-white/60 dark:bg-white/[0.1]"
                : "border-field-line bg-field text-ink-secondary",
              locked && !active ? "cursor-not-allowed opacity-45" : !active && "hover:border-ink/30 hover:text-ink",
            )}
          >
            <span className={clsx("h-2 w-2 rounded-full", toneDotClass(itemStatusTone(status.code)))} />
            {status.label}
          </button>
        );
      })}
    </div>
  );
}
