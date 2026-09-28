import { escapeHtml } from "./printHtml";
import { itemDisplayName } from "./inventory";
import type { InventoryItem } from "../types/api";

/**
 * Prints labels on an A4 sheet, three across, with dashed cut lines. Built
 * in a bare popup (not a print stylesheet on the dashboard) so the sheet
 * prints at its own size, untouched by the app's layout and theme.
 */
export function printLabelSheet(labels: { item: InventoryItem; qrDataUrl: string }[]): boolean {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  const cells = labels
    .map(
      ({ item, qrDataUrl }) => `
      <div class="label">
        <p class="head">ICTD INVENTORY #${item.id}</p>
        <img src="${qrDataUrl}" alt="" />
        <p class="name">${escapeHtml(itemDisplayName(item))}</p>
        <p class="serial">${escapeHtml(item.serial_number)}</p>
      </div>`,
    )
    .join("");
  const title = labels.length === 1 ? `QR label ${labels[0].item.serial_number}` : `${labels.length} QR labels`;
  win.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #fff; color: #000; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; }
      .label { break-inside: avoid; display: flex; flex-direction: column; align-items: center; gap: 1.6mm; padding: 4mm 3mm 5mm; border: 0.3mm dashed #b5b5b5; margin: -0.15mm; }
      .head { margin: 0; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.12em; color: #555; }
      img { width: 38mm; height: 38mm; image-rendering: pixelated; }
      .name { margin: 0; font-size: 9.5pt; font-weight: 800; text-align: center; line-height: 1.2; max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .serial { margin: 0; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 8.5pt; font-weight: 700; color: #333; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      @media screen { body { padding: 10mm; } }
    </style>
  </head>
  <body>
    <div class="sheet">${cells}</div>
    <script>
      window.onload = () => { window.print(); };
    </script>
  </body>
</html>`);
  win.document.close();
  return true;
}
