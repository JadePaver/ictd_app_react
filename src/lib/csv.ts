/** CSV export: the spreadsheet-shaped twin of a report a technician prints. */

export type CsvCell = string | number | null | undefined;

/**
 * Excel, LibreOffice and Sheets all treat a cell whose text begins with one
 * of these as a formula to evaluate. Quoting does NOT prevent it: RFC-4180
 * quotes are a delimiter concern, stripped before the spreadsheet decides
 * what the value is. The fix is to force the cell to text.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * One CSV field: RFC-4180 quoted, and neutralised if a spreadsheet would
 * otherwise run it.
 *
 * The values here are staff-entered (announcement titles, request type
 * labels, names), so a leading `=` is far more likely to be a typo than an
 * attack, but `=HYPERLINK(...)` in a downloaded report is a real enough
 * hazard to be worth a leading apostrophe. That apostrophe does show in the
 * opened cell, which is the accepted trade: a visible oddity beats a
 * silently executing formula.
 *
 * Numbers skip the check. They are produced by this app, never typed by
 * anyone, and a negative delta like `-3` would otherwise be quoted into text
 * and stop being a number in the spreadsheet.
 */
function escapeCell(cell: CsvCell): string {
  if (cell == null) return '""';
  if (typeof cell === "number") return `"${cell}"`;
  const text = FORMULA_TRIGGERS.test(cell) ? `'${cell}` : cell;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvCell[][]): string {
  // CRLF line endings, because Excel on Windows is the destination here.
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/**
 * Hands the browser a file. The BOM matters: without it Excel reads the
 * bytes as the system codepage and mangles any non-ASCII name.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: Safari cancels an in-flight download if the
  // object URL disappears synchronously after the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Filesystem-safe slug for a generated filename ("Jade Paver" -> "jade-paver"). */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .toLowerCase() || "report"
  );
}
