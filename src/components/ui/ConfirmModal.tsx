import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * A reusable in-app stand-in for `window.confirm` — every other "are you
 * sure" moment in this app already renders through `Modal` (delete/return/
 * transfer flows), so a role change or any other confirm-then-mutate action
 * should look the same, not drop into a native browser dialog that ignores
 * the app's theme and blocks the whole tab while it's up.
 */
export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} width="max-w-sm">
      <div className="flex flex-col gap-4">
        {description ? <p className="text-sm text-ink-secondary">{description}</p> : null}
        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone} onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
