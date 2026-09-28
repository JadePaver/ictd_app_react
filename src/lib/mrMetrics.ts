import { formatCountdown, formatDateMedium } from "./format.ts";
import type { Tone } from "./statusStyles";
import type { MemorandumReceiptDetail, MrSegment } from "../types/api";

/**
 * Due-date rules for memorandum receipts. Mirrors
 * ictd_app_express/src/services/custody.ts so the segment an MR is counted
 * in by the API and the label it wears here can never disagree.
 *
 *  - Only an active MR can be late. Closed MRs and MRs without an expected
 *    return date are never overdue.
 *  - "Due soon" is an active MR due within the next three days.
 */
export const DUE_SOON_WINDOW_MS = 3 * 86_400_000;
const DAY_MS = 86_400_000;

type DueFields = { status: string; expected_return_at: string | null };

export type DueState = "closed" | "noDueDate" | "onTrack" | "dueSoon" | "overdue";

export function dueState(mr: DueFields, nowMs = Date.now()): DueState {
  if (mr.status !== "active") return "closed";
  if (!mr.expected_return_at) return "noDueDate";
  const remaining = new Date(mr.expected_return_at).getTime() - nowMs;
  if (Number.isNaN(remaining)) return "noDueDate";
  if (remaining < 0) return "overdue";
  if (remaining < DUE_SOON_WINDOW_MS) return "dueSoon";
  return "onTrack";
}

export function isOverdue(mr: DueFields): boolean {
  return dueState(mr) === "overdue";
}

/** The ledger segment an MR belongs to (no due date counts as on track). */
export function ledgerSegment(mr: DueFields): Exclude<MrSegment, "all" | "active"> {
  const state = dueState(mr);
  return state === "noDueDate" ? "onTrack" : state;
}

export interface DueInfo {
  state: DueState;
  tone: Extract<Tone, "critical" | "warning" | "neutral" | "good">;
  /** The headline: "Overdue", "Due soon", "Due Oct 30, 2026", "No due date". */
  label: string;
  /** The relative half, when there is one: "12 days late", "in 2d". */
  detail: string | null;
}

/**
 * An MR's due date framed the way a library loan reads, so urgency is
 * legible without date math. Closed MRs read as a plain, neutral date: their
 * due date is history, not a live risk.
 */
export function dueInfo(mr: DueFields, nowMs = Date.now()): DueInfo {
  const state = dueState(mr, nowMs);
  const due = mr.expected_return_at;
  switch (state) {
    case "overdue": {
      const late = Math.max(1, Math.floor((nowMs - new Date(due!).getTime()) / DAY_MS));
      return { state, tone: "critical", label: "Overdue", detail: late === 1 ? "1 day late" : `${late} days late` };
    }
    case "dueSoon":
      return { state, tone: "warning", label: "Due soon", detail: formatCountdown(due) };
    case "onTrack":
      return { state, tone: "good", label: `Due ${formatDateMedium(due)}`, detail: null };
    case "noDueDate":
      return { state, tone: "neutral", label: "No due date", detail: null };
    case "closed":
    default:
      return { state, tone: "neutral", label: due ? formatDateMedium(due) : "No due date", detail: null };
  }
}

/** Whole days between two instants (never negative). */
export function daysBetween(fromIso: string, toIso: string = new Date().toISOString()): number {
  return Math.max(0, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

/** Display name for one MR line: brand and model, else the category, else "Item". */
export function mrItemLabel(entry: MemorandumReceiptDetail["items"][number]): string {
  const it = entry.inventory_items;
  const name = it ? [it.brand, it.model].filter(Boolean).join(" ") || it.item_categories?.label : null;
  return name || "Item";
}

// ---- Due dates as calendar days
//
// An MR is due "on a day", so the forms work in YYYY-MM-DD and the API gets
// the last second of that day in the operator's own timezone. Slicing an ISO
// string instead would shift the date by one for anyone east or west of UTC.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local calendar day an ISO timestamp falls on, for a date input. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : toDateInputValue(date);
}

/** "2026-10-30" to the last second of Oct 30 in local time, as ISO. */
export function dateInputToDueIso(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

export function todayPlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function endOfYearInput(): string {
  return `${new Date().getFullYear()}-12-31`;
}

type PartAtIssue = NonNullable<MemorandumReceiptDetail["items"][number]["partsAtIssue"]>[number];

/** One part under its PC on an MR, as printed (context doc v2, 12.2):
 * "GPU · MSI GeForce RTX 3060 Ventus 2X · 602-V397-8KSB2211". */
export function partAtIssueLabel(part: PartAtIssue): string {
  const name = [part.brand, part.model].filter(Boolean).join(" ") || part.item_categories?.label || "Part";
  return [part.item_categories?.label, name, part.serial_number].filter(Boolean).join(" · ");
}
