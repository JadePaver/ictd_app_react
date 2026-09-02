import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { PrintIcon } from "../../components/ui/icons";
import { escapeHtml } from "../../lib/printHtml";
import { mrItemLabel } from "../../lib/mrMetrics";
import { fullName, formatDate, formatDateTime } from "../../lib/format";
import { MrReceiptCard } from "./MrReceiptCard";
import type { MemorandumReceiptDetail } from "../../types/api";

const ACKNOWLEDGMENT =
  "I acknowledge receipt of the property/equipment listed above in good working condition. I accept " +
  "responsibility for its proper care, use, and safekeeping, and agree to return or transfer it through proper channels.";

/**
 * Printable "memorandum receipt" — the physical document this whole
 * feature is named after. Everything else in the MR workflow (the ledger,
 * the detail view, issue/transfer) is about tracking custody digitally;
 * this is the one artifact meant to leave the screen entirely — printed,
 * signed by hand, and either filed or handed to the custodian, the same
 * way InventoryItemQrModal's label leaves the screen to become a physical
 * sticker.
 *
 * Available for any MR regardless of status — reprinting a closed one for
 * audit/record purposes is a normal, legitimate use, so every item's own
 * current status is shown rather than silently implying they're all still
 * out just because the MR once covered them.
 */
export function MrPrintModal({ mr, onClose }: { mr: MemorandumReceiptDetail; onClose: () => void }) {
  function print() {
    const win = window.open("", "_blank", "width=680,height=860");
    if (!win) return;

    const custodianLine = [
      mr.custodian?.employee_number ? `Employee #${mr.custodian.employee_number}` : null,
      mr.departments?.label,
    ]
      .filter(Boolean)
      .join(" · ");

    const rows = mr.items
      .map(
        (entry) => `
          <tr>
            <td>${escapeHtml(mrItemLabel(entry))}</td>
            <td class="mono">${escapeHtml(entry.inventory_items?.serial_number ?? "—")}</td>
            <td class="status">${escapeHtml(entry.status)}</td>
          </tr>`,
      )
      .join("");

    win.document.write(`<!doctype html>
<html>
  <head>
    <title>Memorandum Receipt — ${escapeHtml(mr.mr_number)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 40px; font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #111; }
      .sheet { max-width: 560px; margin: 0 auto; }
      .header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
      .header h1 { margin: 0; font-size: 16px; letter-spacing: 0.06em; }
      .header .sub { margin: 2px 0 0; font-size: 10px; letter-spacing: 0.04em; color: #666; text-transform: uppercase; }
      .header .mr-number { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700; }
      .row { display: flex; gap: 24px; margin-bottom: 12px; }
      .field { flex: 1; }
      .label { margin: 0 0 2px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #777; }
      .value { margin: 0; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f4f4f2; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
      td.mono { font-family: ui-monospace, monospace; }
      td.status { text-transform: capitalize; color: #555; }
      .ack { font-size: 10.5px; line-height: 1.6; color: #333; margin: 22px 0 0; padding-top: 14px; border-top: 1px solid #ddd; }
      .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
      .sig { flex: 1; text-align: center; }
      .sig .line { border-top: 1px solid #111; padding-top: 5px; font-size: 11px; font-weight: 600; }
      .sig .role { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 1px; }
      .footer { margin-top: 28px; font-size: 9px; color: #999; text-align: center; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <h1>MEMORANDUM RECEIPT</h1>
          <p class="sub">Information &amp; Communications Technology Division</p>
        </div>
        <p class="mr-number">${escapeHtml(mr.mr_number)}</p>
      </div>

      <div class="row">
        <div class="field">
          <p class="label">Custodian</p>
          <p class="value">${escapeHtml(fullName(mr.custodian))}</p>
        </div>
        <div class="field">
          <p class="label">Details</p>
          <p class="value">${escapeHtml(custodianLine || "—")}</p>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <p class="label">Issued</p>
          <p class="value">${escapeHtml(formatDateTime(mr.issued_at))} by ${escapeHtml(fullName(mr.issued_by_user))}</p>
        </div>
        <div class="field">
          <p class="label">Expected return</p>
          <p class="value">${mr.expected_return_at ? escapeHtml(formatDate(mr.expected_return_at)) : "No fixed date"}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Item</th><th>Serial #</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="3" style="color:#999">No items on this MR.</td></tr>`}
        </tbody>
      </table>

      ${
        mr.notes
          ? `<div class="row"><div class="field"><p class="label">Notes</p><p class="value">${escapeHtml(mr.notes)}</p></div></div>`
          : ""
      }

      <p class="ack">${escapeHtml(ACKNOWLEDGMENT)}</p>

      <div class="signatures">
        <div class="sig">
          <div class="line">${escapeHtml(fullName(mr.issued_by_user))}</div>
          <p class="role">Issued by</p>
        </div>
        <div class="sig">
          <div class="line">${escapeHtml(fullName(mr.custodian))}</div>
          <p class="role">Received by</p>
        </div>
      </div>

      <p class="footer">Printed ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
    </div>
    <script>
      window.onload = () => { window.print(); };
    </script>
  </body>
</html>`);
    win.document.close();
  }

  return (
    <Modal title="Print memorandum receipt" onClose={onClose} width="max-w-md">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-secondary">
          What prints below — the itemized list, plus signature lines for issuer and custodian. Every item shows its
          current status, so reprinting a closed MR still reads accurately.
        </p>

        <div className="flex justify-center">
          <MrReceiptCard mr={mr} className="w-full max-w-[280px]" />
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
