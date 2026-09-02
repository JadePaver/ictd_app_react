import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { PrintIcon, QrCodeIcon } from "../../components/ui/icons";
import { inventoryQrPayload } from "../../lib/inventoryQr";
import { escapeHtml } from "../../lib/printHtml";
import type { InventoryItem } from "../../types/api";

function itemName(item: { brand?: string | null; model?: string | null }): string {
  return [item.brand, item.model].filter(Boolean).join(" ") || "Item";
}

/**
 * Printable QR label for one inventory item — same payload as the Flutter
 * app's QR sheet (item record only, no custody/MR data), so a label
 * printed from either platform reads identically when scanned.
 *
 * The label card is deliberately hard-coded to black-on-white regardless
 * of the dashboard's theme: a QR code needs light-background/dark-
 * foreground contrast to scan reliably, and this is a print artifact, not
 * themed UI.
 */
export function InventoryItemQrModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const payload = inventoryQrPayload(item);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    const safeSerial = item.serial_number.replace(/[^A-Za-z0-9_-]/g, "-");
    link.download = `ictd-qr-${safeSerial}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Printed in a bare popup window (not via a print stylesheet on the
  // dashboard itself) so the label prints at its own size on its own page,
  // unaffected by the app's layout/theme, and the modal doesn't need to
  // reason about print CSS for the rest of the dashboard chrome around it.
  function printLabel() {
    const canvas = canvasRef.current;
    const win = window.open("", "_blank", "width=380,height=520");
    if (!canvas || !win) return;

    const dataUrl = canvas.toDataURL("image/png");
    const categoryLine = item.item_categories ? `ICTD Inventory · ${item.item_categories.label}` : "ICTD Inventory";
    win.document.write(`<!doctype html>
<html>
  <head>
    <title>QR Label — ${escapeHtml(item.serial_number)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; background: #fff; }
      .card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px; }
      img { width: 208px; height: 208px; }
      .name { margin: 0; font-size: 14px; font-weight: 800; color: #000; text-align: center; }
      .serial { margin: 0; font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: rgba(0, 0, 0, 0.7); }
      .meta { margin: 0; font-size: 10px; font-weight: 600; letter-spacing: 0.02em; color: rgba(0, 0, 0, 0.5); }
      @media print { body { min-height: 0; } }
    </style>
  </head>
  <body>
    <div class="card">
      <img src="${dataUrl}" alt="QR code" />
      <p class="name">${escapeHtml(itemName(item))}</p>
      <p class="serial">${escapeHtml(item.serial_number)}</p>
      <p class="meta">${escapeHtml(categoryLine)}</p>
    </div>
    <script>
      window.onload = () => { window.print(); };
    </script>
  </body>
</html>`);
    win.document.close();
  }

  return (
    <Modal title="QR Label" onClose={onClose} width="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-secondary">Scanning this label shows the item's details — no custody records.</p>

        <div className="flex justify-center">
          <div className="flex w-64 flex-col items-center gap-3 rounded-2xl border border-[#e2e2e2] bg-white p-5 shadow-sm">
            <QRCodeCanvas
              ref={canvasRef}
              value={payload}
              size={208}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#000000"
            />
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="max-w-[14rem] text-sm font-extrabold text-black">{itemName(item)}</p>
              <p className="font-mono text-xs font-bold tracking-wide text-black/70">{item.serial_number}</p>
              <p className="text-[10px] font-semibold tracking-wide text-black/50">
                {item.item_categories ? `ICTD Inventory · ${item.item_categories.label}` : "ICTD Inventory"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-series-1/8 p-3">
          <QrCodeIcon size={16} className="mt-0.5 shrink-0 text-series-1" />
          <p className="text-xs text-ink-secondary">
            Download the label and print it (or send it to a portable label printer), then attach it to the
            physical item.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={printLabel} className="flex-1 justify-center gap-2">
            <PrintIcon size={14} />
            Print
          </Button>
          <Button onClick={downloadPng} className="flex-1 justify-center gap-2">
            Download PNG
          </Button>
        </div>
      </div>
    </Modal>
  );
}
