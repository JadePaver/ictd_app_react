import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "./icons";

/** Modals can nest (e.g. ItemDetailModal opens InventoryItemQrModal on
 * top of itself). Every open modal registers here in mount order, and the
 * Escape handler only acts when it belongs to the stack's top — otherwise
 * one keypress would close the whole stack at once. */
const openModalStack: symbol[] = [];

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: {
  title: ReactNode;
  /** One line under the title: what this dialog is about, in context. */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Actions pinned to the bottom edge of the viewport while the dialog
   * scrolls, so a long form never hides its submit button. A form inside
   * the body reaches a footer button through the button's `form` attribute. */
  footer?: ReactNode;
  width?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stackId = Symbol("modal");
    openModalStack.push(stackId);

    // Move focus into the dialog so Escape works immediately and screen
    // readers announce it; restore focus to the opener when it closes.
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    // The page behind the overlay shouldn't scroll while a modal is up.
    // Nested modals capture "hidden" and restore it, so unwinding in any
    // order still lands on the original value.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && openModalStack[openModalStack.length - 1] === stackId) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      openModalStack.splice(openModalStack.indexOf(stackId), 1);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
    // onClose is intentionally not a dependency: this effect is mount-only
    // setup/teardown, and re-running it on every parent render would
    // repeatedly steal focus back to the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      // Close on true backdrop clicks only — a click that starts inside the
      // panel (e.g. a text-selection drag that ends outside) must not close.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 [animation:modal-backdrop-in_200ms_ease-out] sm:pt-20"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${width} rounded-2xl border border-[color:var(--border-hairline)] bg-surface/70 p-6 shadow-xl outline-none backdrop-blur-xl backdrop-saturate-150 [animation:modal-panel-in_240ms_cubic-bezier(0.22,1,0.36,1)]`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {subtitle ? <div className="mt-0.5 text-sm text-ink-muted">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/[0.08]"
          >
            <XIcon size={16} />
          </button>
        </div>
        {children}
        {footer ? (
          <div className="sticky bottom-0 z-10 -mx-6 mt-6 -mb-6 flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-[color:var(--border-hairline)] bg-surface/95 px-6 py-4 backdrop-blur-xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
