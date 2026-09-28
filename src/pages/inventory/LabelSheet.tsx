import { useRef, type ReactNode } from "react";
import { QRCodeCanvas } from "qrcode.react";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { PlusIcon, PrintIcon } from "../../components/ui/icons";
import { inventoryQrPayload } from "../../lib/inventoryQr";
import { itemDisplayName } from "../../lib/inventory";
import { printLabelSheet } from "../../lib/labelPrint";
import type { InventoryItem } from "../../types/api";

/** The QR bitmap is drawn at this size and shown smaller, so the printed
 * label stays sharp at 38 mm instead of being a blurry upscale. */
const QR_BITMAP = 320;

/**
 * One item label, drawn as the real sticker: black on white whatever the
 * theme, because a QR code needs that contrast to scan (context doc 11.3).
 * `ICTD INVENTORY #id` on top, the QR, then the name and serial or asset tag.
 */
export function ItemLabel({
  item,
  qrSize = 150,
  canvasRef,
  className,
  idText,
}: {
  item: InventoryItem;
  qrSize?: number;
  /** Replaces "#id", for a preview of an item not saved yet. */
  idText?: string;
  canvasRef?: (el: HTMLCanvasElement | null) => void;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-2 rounded-xl border border-[#e2e2e2] bg-white px-4 pt-3 pb-4 text-black shadow-sm",
        className,
      )}
    >
      <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-black/60">ICTD INVENTORY {idText ?? `#${item.id}`}</p>
      <QRCodeCanvas
        ref={canvasRef}
        value={inventoryQrPayload(item)}
        size={QR_BITMAP}
        style={{ width: qrSize, height: qrSize }}
        level="M"
        marginSize={2}
        bgColor="#ffffff"
        fgColor="#000000"
      />
      <div className="flex max-w-full flex-col items-center gap-0.5 text-center">
        <p className="line-clamp-2 text-sm leading-tight font-extrabold text-black">{itemDisplayName(item)}</p>
        <p className="max-w-full truncate font-mono text-xs font-bold tracking-wide text-black/70">{item.serial_number}</p>
      </div>
    </div>
  );
}

/**
 * The QR label sheet (form F7): every label from a register sitting, a bulk
 * run, or an assembled PC, printed together on A4.
 */
export function LabelSheetModal({
  items,
  title,
  subtitle,
  note,
  onClose,
  onRegisterNext,
  registerNextLabel = "Register next",
}: {
  items: InventoryItem[];
  title?: string;
  subtitle?: ReactNode;
  /** Shown above the labels, e.g. the parts now linked to a new PC. */
  note?: ReactNode;
  onClose: () => void;
  onRegisterNext?: () => void;
  registerNextLabel?: string;
}) {
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const count = items.length;

  function print() {
    const labels = items
      .map((item) => {
        const canvas = canvases.current.get(item.id);
        return canvas ? { item, qrDataUrl: canvas.toDataURL("image/png") } : null;
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);
    printLabelSheet(labels);
  }

  return (
    <Modal
      title={title ?? (count === 1 ? "QR label" : `${count} QR labels`)}
      subtitle={subtitle ?? "Print them, then stick each label on its item."}
      onClose={onClose}
      width={count === 1 ? "max-w-md" : "max-w-3xl"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Done
          </Button>
          {onRegisterNext ? (
            <Button type="button" variant="secondary" onClick={onRegisterNext}>
              <PlusIcon size={14} />
              {registerNextLabel}
            </Button>
          ) : null}
          <Button type="button" onClick={print} disabled={count === 0}>
            <PrintIcon size={14} />
            {count === 1 ? "Print label" : `Print ${count} labels`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {note}
        <div
          className={clsx(
            "grid gap-3 rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.05]",
            count === 1 ? "grid-cols-1 justify-items-center" : "grid-cols-2 sm:grid-cols-3",
            count > 6 && "max-h-[52vh] overflow-y-auto",
          )}
        >
          {items.map((item) => (
            <ItemLabel
              key={item.id}
              item={item}
              qrSize={count === 1 ? 190 : 118}
              className={count === 1 ? "w-64" : undefined}
              canvasRef={(el) => {
                if (el) canvases.current.set(item.id, el);
                else canvases.current.delete(item.id);
              }}
            />
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          Labels print three across on A4 with cut lines. Each QR holds the item's record, including its PAR, but never who has it.
        </p>
      </div>
    </Modal>
  );
}
