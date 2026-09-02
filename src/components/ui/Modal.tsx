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
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
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
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/[0.08]"
          >
            <XIcon size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
