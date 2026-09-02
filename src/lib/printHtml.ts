const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for safe interpolation into a raw HTML string handed to
 * `document.write()` in a print popup (InventoryItemQrModal, MrPrintModal)
 * — those windows are built from a template string, not JSX, so nothing
 * else escapes user-entered values (names, notes, serials) on the way in. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
