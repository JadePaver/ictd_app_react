import type { ReactNode } from "react";
import clsx from "clsx";
import { ChevronDownIcon, ChevronUpIcon, SortIcon } from "./icons";

export type SortDir = "asc" | "desc";

/** Clickable `<th>` that shows the active sort direction, or a faint
 * two-way indicator for sortable-but-inactive columns. Toggles asc/desc
 * on repeat clicks of the active column (handled by the caller's onSort). */
export function SortableTh<T extends string>({
  field,
  activeField,
  dir,
  onSort,
  children,
  className,
}: {
  field: T;
  activeField: T;
  dir: SortDir;
  onSort: (field: T) => void;
  children: ReactNode;
  className?: string;
}) {
  const isActive = field === activeField;
  return (
    <th className={clsx("px-4 py-3 font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={clsx("inline-flex items-center gap-1 transition-colors hover:text-ink-secondary", isActive && "text-ink")}
      >
        <span>{children}</span>
        {isActive ? (
          dir === "asc" ? (
            <ChevronUpIcon size={13} />
          ) : (
            <ChevronDownIcon size={13} />
          )
        ) : (
          <SortIcon size={13} className="opacity-30" />
        )}
      </button>
    </th>
  );
}
