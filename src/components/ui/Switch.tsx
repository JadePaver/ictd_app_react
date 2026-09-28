import { useId } from "react";
import clsx from "clsx";

/** An on/off switch with its label, for settings that apply to what happens
 * next ("Keep details for the next item") rather than to the record itself. */
export function Switch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1",
          checked ? "bg-series-1" : "bg-black/15 dark:bg-white/20",
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-xs text-ink-secondary select-none">
        {label}
      </label>
    </span>
  );
}
