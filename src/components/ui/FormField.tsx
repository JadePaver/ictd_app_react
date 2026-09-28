import { Fragment, type ComponentProps, type ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangleIcon } from "./icons";
import { FieldContext, focusField, useFieldState } from "./formFieldContext";

/**
 * The look every text field shares: a solid fill and an edge firm enough to
 * find an empty field at a glance on the frosted modal panel, a hover step,
 * a green focus halo, and a red state (`aria-invalid`) that stays red while
 * the operator is inside the field fixing it, instead of turning green the
 * moment they click in.
 */
export const fieldInputClass =
  "w-full rounded-lg border border-field-line bg-field px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-muted enabled:hover:border-field-line-hover focus:border-series-1 focus:ring-3 focus:ring-series-1/15 aria-[invalid=true]:border-critical/70 aria-[invalid=true]:enabled:hover:border-critical aria-[invalid=true]:focus:border-critical aria-[invalid=true]:focus:ring-critical/15 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-ink-muted dark:disabled:bg-white/[0.04]";

/** Serials, asset tags, PAR codes and MR numbers (context doc 7): monospace,
 * with a slashed zero so 0 and O can't be mixed up when copying one off a
 * sticker. */
export const fieldMonoClass = "font-mono slashed-zero tracking-wide";

function joinIds(...ids: (string | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

/** A field's label, with the required marker. FormField uses it; a field
 * that lays itself out (ParField) uses it directly so both look the same. */
export function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="text-[13px] font-medium text-ink-secondary" htmlFor={htmlFor}>
      {children}
      {required ? (
        <span className="text-critical" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

/** The line under a field: the error when there is one, else the hint. */
export function FieldMessage({ id, error, hint }: { id: string; error?: ReactNode; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={id} className="flex items-start gap-1 text-xs font-medium text-critical">
        <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-xs text-ink-muted">
      {hint}
    </p>
  ) : null;
}

/** Label + required marker + error/hint text, wrapping a single control.
 * Shared by every inventory/MR form so validation styling and required-field
 * markers stay identical across all of them. A TextInput, TextArea or
 * Combobox inside picks up the field's id, its message and its invalid state
 * on its own, so screen readers read the hint or error with the field. */
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
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const messageId = `${htmlFor}-message`;
  return (
    <FieldContext.Provider value={{ id: htmlFor, messageId: error || hint ? messageId : undefined, invalid: !!error, required: !!required }}>
      <div className={clsx("flex flex-col gap-1.5", className)}>
        <FieldLabel htmlFor={htmlFor} required={required}>
          {label}
        </FieldLabel>
        {children}
        <FieldMessage id={messageId} error={error} hint={hint} />
      </div>
    </FieldContext.Provider>
  );
}

type TextInputProps = ComponentProps<"input"> & {
  /** Monospace with a slashed zero, for serials and document numbers. */
  mono?: boolean;
  /** Overrides the invalid state taken from the surrounding FormField. */
  invalid?: boolean;
  /** An icon or unit inside the left edge (₱, a receipt). */
  leading?: ReactNode;
  /** Status inside the right edge: a spinner while checking, a tick once
   * clear. Pass `null` to keep the space while there's nothing to show, so
   * the text doesn't shift when the status appears. */
  trailing?: ReactNode;
};

/** A single-line text field. Inside a FormField it wires its own id,
 * `aria-describedby`, `aria-invalid` and `aria-required`. */
export function TextInput({ mono, invalid, leading, trailing, className, id, "aria-describedby": describedBy, ...props }: TextInputProps) {
  const field = useFieldState();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const input = (
    <input
      id={id ?? field?.id}
      aria-invalid={isInvalid || undefined}
      aria-describedby={joinIds(describedBy, field?.messageId)}
      aria-required={field?.required || undefined}
      {...props}
      className={clsx(fieldInputClass, mono && fieldMonoClass, leading !== undefined && "pl-9", trailing !== undefined && "pr-9", className)}
    />
  );
  if (leading === undefined && trailing === undefined) return input;
  return (
    <div className="relative">
      {leading !== undefined ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-sm text-ink-muted">{leading}</span>
      ) : null}
      {input}
      {trailing !== undefined ? <span className="absolute inset-y-0 right-0 flex w-9 items-center justify-center">{trailing}</span> : null}
    </div>
  );
}

type TextAreaProps = ComponentProps<"textarea"> & {
  mono?: boolean;
  invalid?: boolean;
  /** Grows with its content up to this many lines, then scrolls. */
  maxRows?: number;
};

/** A multi-line field that starts at `rows` lines and grows as the operator
 * types (where the browser supports it), so a long description never hides
 * behind a two-line box. Resizes vertically only, so it can't break the
 * form's columns. */
export function TextArea({ mono, invalid, maxRows = 12, rows = 3, className, style, id, "aria-describedby": describedBy, ...props }: TextAreaProps) {
  const field = useFieldState();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      id={id ?? field?.id}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={joinIds(describedBy, field?.messageId)}
      aria-required={field?.required || undefined}
      {...props}
      style={{ minHeight: `calc(${rows}lh + 1rem + 2px)`, maxHeight: `calc(${maxRows}lh + 1rem + 2px)`, ...style }}
      className={clsx(fieldInputClass, "block resize-y field-sizing-content", mono && fieldMonoClass, className)}
    />
  );
}

/** Groups related fields under a heading with a divider below, so a long
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

/** One entry in a FormProblems banner: the field's name, and the id of the
 * control (or radio group) that jumping to it should land on. */
export interface FieldProblem {
  label: string;
  target: string;
}

/** The banner a form shows at the top when submitted with problems, naming
 * the fields: "3 fields need attention: PAR code, Category, Serial number".
 * Each name jumps to its field. */
export function FormProblems({ problems }: { problems: FieldProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-critical/25 bg-critical/[0.07] px-3 py-2 text-sm text-critical">
      <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">
          {problems.length === 1 ? "1 field needs attention" : `${problems.length} fields need attention`}:
        </span>{" "}
        {problems.map((problem, i) => (
          <Fragment key={problem.target}>
            {i > 0 ? ", " : null}
            <button
              type="button"
              onClick={() => focusField(problem.target)}
              className="cursor-pointer underline decoration-critical/40 underline-offset-2 hover:decoration-critical"
            >
              {problem.label}
            </button>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
