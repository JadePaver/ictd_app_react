import type { InventoryItem } from "../types/api";

/**
 * The text a scanner reads off an item's QR label: every fact on the item
 * record except custody/MR data (that changes hands; the label doesn't).
 * Plain human-readable lines, matching the same format the Flutter app's
 * `inventoryQrPayload()` produces (see ictd_app/lib/views/inventory/
 * components/inventory_qr_sheet.dart), so a label printed from either
 * platform reads identically.
 */
export function inventoryQrPayload(item: InventoryItem): string {
  // Long descriptions bloat the QR into an unscannable dot soup on a small
  // label; a single collapsed line capped at 160 chars keeps the module
  // density printable.
  let notes = item.description?.replace(/\s+/g, " ").trim();
  if (notes && notes.length > 160) {
    notes = `${notes.slice(0, 159)}…`;
  }

  const lines = [
    `ICTD INVENTORY #${item.id}`,
    `Serial: ${item.serial_number}`,
    // v2: the PAR it came in, when it has one. Placement is left off for
    // the same reason custody is: it changes, and a printed label doesn't.
    item.par?.par_code ? `PAR: ${item.par.par_code}` : null,
    item.item_categories ? `Category: ${item.item_categories.label}` : null,
    item.brand?.trim() ? `Brand: ${item.brand.trim()}` : null,
    item.model?.trim() ? `Model: ${item.model.trim()}` : null,
    item.item_statuses ? `Status: ${item.item_statuses.label}` : null,
    item.departments?.label ? `Department: ${item.departments.label}` : null,
    notes ? `Notes: ${notes}` : null,
    `Registered: ${new Date(item.created_at).toLocaleDateString()}`,
  ];
  return lines.filter((line): line is string => line != null).join("\n");
}
