import { useRef } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { PrintIcon } from "../../components/ui/icons";
import { personColor } from "../../components/ui/Avatar";
import { escapeHtml } from "../../lib/printHtml";
import { fullName } from "../../lib/format";
import { officeName } from "../../lib/inventory";
import { CustodianBadgeCard } from "./CustodianBadgeCard";
import type { Custodian } from "../../types/api";

/**
 * Printable ID badge — completes the same "physical artifact" pattern as
 * InventoryItemQrModal (a QR sticker) and MrPrintModal (a signable receipt):
 * this one's meant to be printed, cut out, and slotted into a badge holder
 * or lanyard, not read on screen. The preview above the print button is the
 * real CustodianBadgeCard, not a re-described summary, so what prints is
 * exactly what's shown.
 */
export function CustodianBadgePrintModal({ custodian, onClose }: { custodian: Custodian; onClose: () => void }) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const color = personColor(custodian);

  function print() {
    const canvas = qrRef.current;
    const win = window.open("", "_blank", "width=380,height=560");
    if (!canvas || !win) return;

    const dataUrl = canvas.toDataURL("image/png");
    const initials =
      ((custodian.first_name?.trim()?.[0] ?? "") + (custodian.last_name?.trim()?.[0] ?? "")).toUpperCase() || "?";
    const meta = [custodian.employee_number ? `#${custodian.employee_number}` : null, custodian.departments ? officeName(custodian.departments) : null]
      .filter(Boolean)
      .join(" · ");

    win.document.write(`<!doctype html>
<html>
  <head>
    <title>ID Badge: ${escapeHtml(fullName(custodian))}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; background: #f2f2f0; }
      .badge { width: 220px; border-radius: 18px; overflow: hidden; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.18); position: relative; }
      .clip { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 36px; height: 10px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.15); background: rgba(255,255,255,0.9); z-index: 1; }
      .band { padding: 20px 0 36px; text-align: center; background: linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, black)); }
      .band p { margin: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.85); }
      .photo { width: 68px; height: 68px; border-radius: 999px; border: 3px solid #fff; margin: -32px auto 0; box-shadow: 0 2px 6px rgba(0,0,0,0.2); background: color-mix(in oklab, ${color} 16%, white); color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
      .id { text-align: center; padding: 8px 16px 12px; }
      .id .name { margin: 0; font-size: 15px; font-weight: 700; color: #111; }
      .id .sub { margin: 2px 0 0; font-family: ui-monospace, monospace; font-size: 11px; color: rgba(0,0,0,0.45); }
      .id .dept { margin: 1px 0 0; font-size: 12px; color: rgba(0,0,0,0.6); }
      .qr { display: flex; justify-content: center; padding: 12px; border-top: 1px solid rgba(0,0,0,0.1); background: rgba(0,0,0,0.02); }
      .qr img { width: 64px; height: 64px; }
      @media print { body { background: #fff; min-height: 0; } .badge { box-shadow: none; } }
    </style>
  </head>
  <body>
    <div class="badge">
      <div class="clip"></div>
      <div class="band"><p>ICTD Property Custodian</p></div>
      <div class="photo">${escapeHtml(initials)}</div>
      <div class="id">
        <p class="name">${escapeHtml(fullName(custodian))}</p>
        <p class="sub">${escapeHtml(meta || "—")}</p>
      </div>
      <div class="qr"><img src="${dataUrl}" alt="QR code" /></div>
    </div>
    <script>
      window.onload = () => { window.print(); };
    </script>
  </body>
</html>`);
    win.document.close();
  }

  return (
    <Modal title="Print ID badge" onClose={onClose} width="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-secondary">Prints a card sized for a badge holder. Cut it out and slot it into a lanyard or clip. The custody tag is left off, since it changes and the badge does not.</p>

        <div className="flex justify-center">
          <CustodianBadgeCard custodian={custodian} className="w-full max-w-[220px]" qrRef={qrRef} hideTag />
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={print} className="gap-2">
            <PrintIcon size={14} />
            Print
          </Button>
        </div>
      </div>
    </Modal>
  );
}
