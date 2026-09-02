import type { ReactNode } from "react";
import clsx from "clsx";

export const fieldInputClass =
  "w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

/** Label + required marker + error/hint text, wrapping a single control.
 * Shared by every inventory/MR form (IssueMrModal, TransferMrModal,
 * ItemFormModal, CustodianPicker's inline add-new) so validation styling
 * and required-field markers stay identical across all of them. */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Shown in place of `hint`, in critical color, once the field has an error. */
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-ink-muted" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-critical" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-critical">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Groups related fields under a heading with a divider below — the section
 * layout requested for IssueMrModal/TransferMrModal/ItemFormModal so a long
 * form reads as "MR details / Custodian / Items / Notes" instead of one
 * undifferentiated stack of inputs. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--border-hairline)] pb-5 last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
