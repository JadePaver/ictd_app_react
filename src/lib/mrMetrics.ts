import { formatCountdown, formatDate, formatRelativeTime } from "./format";
import type { Tone } from "./statusStyles";
import type { MemorandumReceiptDetail } from "../types/api";

export interface DueStatus {
  label: string;
  tone: Extract<Tone, "critical" | "warning" | "neutral" | "good">;
}

/** How far ahead of the due date "due soon" starts counting — long enough
 * to actually plan a follow-up, short enough that it still means "soon". */
const DUE_SOON_WINDOW_MS = 3 * 86_400_000;

/**
 * Frames an MR's `expected_return_at` the way a library due-date reads —
 * "Overdue — 3d ago" / "Due soon — in 2d" / "Due Jul 20" — instead of a bare
 * date next to a status pill, so urgency is legible without doing date math
 * by eye. Shared by MrListPage (the ledger's due column and segments),
 * MrDetailModal, and CustodianDetailModal's MR history list.
 *
 * Only meaningful for a still-open MR: a closed one's due date is just a
 * record of what the target used to be, not a live risk, so it always
 * reads as plain neutral text regardless of how far past it is.
 */
export function dueStatus(mr: { status: string; expected_return_at: string | null }): DueStatus {
  if (!mr.expected_return_at) return { label: "No due date", tone: "neutral" };
  if (mr.status !== "active") return { label: formatDate(mr.expected_return_at), tone: "neutral" };

  const msRemaining = new Date(mr.expected_return_at).getTime() - Date.now();
  if (msRemaining < 0) return { label: `Overdue — ${formatRelativeTime(mr.expected_return_at)}`, tone: "critical" };
  if (msRemaining < DUE_SOON_WINDOW_MS) return { label: `Due soon — ${formatCountdown(mr.expected_return_at)}`, tone: "warning" };
  return { label: `Due ${formatDate(mr.expected_return_at)}`, tone: "good" };
}

export function isOverdue(mr: { status: string; expected_return_at: string | null }): boolean {
  return mr.status === "active" && !!mr.expected_return_at && new Date(mr.expected_return_at).getTime() < Date.now();
}

export function isDueSoon(mr: { status: string; expected_return_at: string | null }): boolean {
  if (mr.status !== "active" || !mr.expected_return_at) return false;
  const msRemaining = new Date(mr.expected_return_at).getTime() - Date.now();
  return msRemaining >= 0 && msRemaining < DUE_SOON_WINDOW_MS;
}

/** Display name for one MR line item — brand+model, falling back to its
 * category when neither is set. Shared by MrDetailModal, TransferMrModal,
 * and MrPrintModal so the same item reads identically everywhere it's
 * listed. */
export function mrItemLabel(entry: MemorandumReceiptDetail["items"][number]): string {
  const it = entry.inventory_items;
  const name = it ? [it.brand, it.model].filter(Boolean).join(" ") || it.item_categories?.label : null;
  return name || "Item";
}
