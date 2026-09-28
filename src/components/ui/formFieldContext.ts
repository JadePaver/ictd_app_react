import { createContext, useContext } from "react";

export interface FieldState {
  id: string;
  /** The hint or error under the field, once there is one. */
  messageId?: string;
  invalid: boolean;
  required: boolean;
}

/** Set by FormField for the control inside it. Lives apart from
 * FormField.tsx so that file exports only components (fast refresh). */
export const FieldContext = createContext<FieldState | null>(null);

/** What a control inside a FormField needs to tie itself to the label and
 * the text under it: its id, the message's id, and whether it reads as
 * invalid or required. Null outside a FormField. */
export function useFieldState() {
  return useContext(FieldContext);
}

/** Scrolls a field into the middle of the view and puts the cursor in it. A
 * radio group hands focus to its selected (or first) option. */
export function focusField(target: string | HTMLElement | null) {
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el) return;
  const focusable = el.matches("input, textarea, select, button, [tabindex]")
    ? el
    : (el.querySelector<HTMLElement>('[tabindex="0"]') ??
      el.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), button:not([disabled])"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  (focusable ?? el).focus({ preventScroll: true });
}

/** After a submit with problems: take the operator to the first flagged
 * field, instead of leaving them at the footer's button with the banner
 * scrolled out of sight. Runs a frame later, once the errors are rendered. */
export function focusFirstProblem(container: HTMLElement | null) {
  window.requestAnimationFrame(() => focusField(container?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? null));
}
