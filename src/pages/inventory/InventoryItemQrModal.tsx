import { useRef } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { DownloadIcon, PrintIcon, QrCodeIcon } from "../../components/ui/icons";
import type { InventoryItem } from "../../types/api";
import { ItemLabel } from "./LabelSheet";
import { printLabelSheet } from "../../lib/labelPrint";

/**
 * Printable QR label for one inventory item. Same payload as the Flutter
 * app's QR sheet (the item record, never custody), so a label printed from
 * either platform reads identically when scanned.
 */
export function InventoryItemQrModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    const safeSerial = item.serial_number.replace(/[^A-Za-z0-9_-]/g, "-");
    link.download = `ictd-qr-${safeSerial}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function print() {
    const canvas = canvasRef.current;
    if (canvas) printLabelSheet([{ item, qrDataUrl: canvas.toDataURL("image/png") }]);
  }

  return (
    <Modal title="QR label" subtitle="Scanning it shows the item's record, never who has it." onClose={onClose} width="max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex justify-center rounded-xl bg-black/[0.035] p-4 dark:bg-white/[0.05]">
          <ItemLabel
            item={item}
            qrSize={190}
            className="w-64"
            canvasRef={(el) => {
              canvasRef.current = el;
            }}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-series-1/8 p-3">
          <QrCodeIcon size={16} className="mt-0.5 shrink-0 text-series-1" />
          <p className="text-xs text-ink-secondary">
            Print the label (or send the PNG to a portable label printer), then attach it to the physical item.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={downloadPng} className="flex-1 justify-center gap-2">
            <DownloadIcon size={14} />
            Download PNG
          </Button>
          <Button onClick={print} className="flex-1 justify-center gap-2">
            <PrintIcon size={14} />
            Print
          </Button>
        </div>
      </div>
    </Modal>
  );
}
