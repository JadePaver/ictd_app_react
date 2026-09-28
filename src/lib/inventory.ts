import type { Tone } from "./statusStyles";
import { formatCalendarDate } from "./format.ts";
import type { Accountability, Department, InventoryItem, ItemCategory, ItemStatusRef, MrStatus, Par } from "../types/api";

/** Display name rule used everywhere (context doc 3.1): brand and model,
 * else the category label, else "Item". */
export function itemDisplayName(item: {
  brand?: string | null;
  model?: string | null;
  item_categories?: Pick<ItemCategory, "label"> | null;
}): string {
  return [item.brand, item.model].filter(Boolean).join(" ") || item.item_categories?.label || "Item";
}

/** Item statuses in the order the inventory tabs list them: the two states
 * MRs move items between, then the ones that need attention. */
export const ITEM_STATUS_ORDER = ["in_storage", "in_use", "under_repair", "missing", "decommissioned"];

/** What one MR line's status means for that item, in the words the mobile
 * app's custody timeline already uses. */
export function lineStatusLabel(status: MrStatus): string {
  switch (status) {
    case "active":
      return "In custody";
    case "returned":
      return "Returned";
    case "transferred":
    default:
      return "Transferred";
  }
}

export function lineStatusTone(status: MrStatus): Tone {
  switch (status) {
    case "active":
      return "accent";
    case "returned":
      return "good";
    default:
      return "neutral";
  }
}

export function mrStatusLabel(status: MrStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "returned":
      return "Returned";
    case "transferred":
    default:
      return "Transferred";
  }
}

export interface AccountabilityTag {
  label: string;
  tone: Extract<Tone, "critical" | "accent" | "neutral">;
}

/** The custodian badge's accountability tag (context doc 5.4): overdue wins,
 * then anything on loan, else clear. */
export function accountabilityTag(c: Partial<Accountability>): AccountabilityTag {
  if (c.overdueItemCount) return { label: `${c.overdueItemCount} OVERDUE`, tone: "critical" };
  if (c.activeItemCount) return { label: `${c.activeItemCount} ON LOAN`, tone: "accent" };
  return { label: "CLEAR", tone: "neutral" };
}

// ---- Office names
//
// Department labels are stored in capitals ("OFFICE OF THE PROVINCIAL
// ACCOUNTANT"), which is heavy going in a dense table. `officeName` title-
// cases them for display while keeping the acronyms that are part of the
// name (PHO, EEDD, PSWDO, ICT, AICS...). A word stays in capitals if it is a
// known acronym, the department's own code, has no vowels, or is three
// letters or fewer and not an ordinary short word.

const KNOWN_ACRONYMS = new Set([
  "ICT", "ICTD", "PHO", "PSWD", "PSWDO", "EEDD", "OPA", "PVO", "PEO", "PEMO", "NOSP", "AICS", "FITS",
  "EGTE", "PRDP", "COA", "RTC", "BAC", "GSO", "PHRMO", "PPDO", "PBO", "PTO", "PLO", "PID", "DRRM",
  "DILG", "CSC", "PESO", "BNS", "BHW", "SP", "IT",
]);

const LOWERCASE_WORDS = new Set(["of", "the", "and", "for", "to", "in", "on", "at", "a", "an", "with", "by"]);
const ORDINARY_SHORT_WORDS = new Set(["use", "day", "new", "old", "one", "two", "sea", "way", "art", "law", "man"]);

function caseWord(word: string, index: number, acronyms: Set<string>): string {
  const letters = word.replace(/[^A-Za-z]/g, "");
  if (!letters) return word;
  const upper = letters.toUpperCase();
  const lower = word.toLowerCase();
  if (word.endsWith(".") && letters.length > 1) return lower.charAt(0).toUpperCase() + lower.slice(1); // "Gov."
  if (acronyms.has(upper) || KNOWN_ACRONYMS.has(upper)) return word.toUpperCase();
  if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
  if (!/[AEIOUY]/i.test(letters)) return word.toUpperCase();
  if (letters.length <= 3 && !LOWERCASE_WORDS.has(lower) && !ORDINARY_SHORT_WORDS.has(lower)) return word.toUpperCase();
  const start = word.search(/[A-Za-z]/);
  return word.slice(0, start) + word.charAt(start).toUpperCase() + word.slice(start + 1).toLowerCase();
}

export function officeName(dept: Pick<Department, "label" | "code"> | null | undefined, fallback = "No office"): string {
  const label = dept?.label?.replace(/\s+/g, " ").trim();
  if (!label) return fallback;
  // Already mixed case: somebody typed it the way they want it shown.
  if (label !== label.toUpperCase()) return label;
  const acronyms = new Set(dept?.code ? [dept.code.trim().toUpperCase()] : []);
  return label
    .split(" ")
    .map((token, index) =>
      // Hyphen- and slash-joined parts ("PEO-CONSTRUCTION", "RANCH/FARMS")
      // are cased one by one, but never as lowercase small words.
      token
        .split(/([-/])/)
        .map((part) => (part === "-" || part === "/" ? part : caseWord(part, token.includes("-") || token.includes("/") ? 0 : index, acronyms)))
        .join(""),
    )
    .join(" ");
}

/** A compact identifier for an office: its code when it has one. */
export function officeCode(dept: Pick<Department, "label" | "code"> | null | undefined): string | null {
  return dept?.code?.trim() || null;
}

// ---- v2: PARs, parts and assembled PCs

/** Part categories in the order pickers and specs list them. */
export const PART_CATEGORY_ORDER = ["cpu", "gpu", "ram", "storage"];

/** The reference list's order (context doc v2, 3.3). */
const CATEGORY_ORDER = ["computer", "monitor", "keyboard", "mouse", "cpu", "gpu", "ram", "storage", "printer", "networking", "peripheral", "other"];

/** Units first, then parts, each in reference order (v2, 3.3). Unknown
 * categories go last, by label. */
export function groupCategories<T extends Pick<ItemCategory, "is_part" | "code" | "label">>(categories: T[]): { units: T[]; parts: T[] } {
  const rank = (c: T) => {
    const i = CATEGORY_ORDER.indexOf(c.code);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  const sorted = [...categories].sort((x, y) => rank(x) - rank(y) || x.label.localeCompare(y.label));
  return { units: sorted.filter((c) => !c.is_part), parts: sorted.filter((c) => c.is_part) };
}

/** Where an item sits, in words for a header card (F4). */
export function placementText(item: Pick<InventoryItem, "installed_in_item_id" | "currentCustody">): string {
  if (item.installed_in_item_id) return `Installed in PC #${item.installed_in_item_id}`;
  const c = item.currentCustody;
  if (c?.custodian) return `With ${[c.custodian.first_name, c.custodian.last_name].filter(Boolean).join(" ")} · ${c.mrNumber}`;
  return "In ICTD storage";
}

/**
 * The description an assembled PC gets from its parts (F5): CPU, then GPU,
 * then RAM, then storage, joined with " / ". Each part contributes its
 * model, or brand and model when the model alone is short.
 */
export function describeFromParts(
  parts: Pick<InventoryItem, "brand" | "model" | "item_categories">[],
): string {
  const rank = (code: string | undefined) => {
    const i = PART_CATEGORY_ORDER.indexOf(code ?? "");
    return i === -1 ? PART_CATEGORY_ORDER.length : i;
  };
  return [...parts]
    .sort((a, b) => rank(a.item_categories?.code) - rank(b.item_categories?.code))
    .map((p) => (p.model?.trim() || p.brand?.trim() || p.item_categories?.label || "").trim())
    .filter(Boolean)
    .join(" / ");
}

/** Statuses the register forms offer: never In use, which only an MR sets. */
export function registerStatusOptions<T extends Pick<ItemStatusRef, "code">>(statuses: T[]): T[] {
  return statuses.filter((s) => s.code !== "in_use");
}

/** Statuses a part can take when it comes out of a PC (rule 22). */
export const REMOVAL_STATUSES = [
  { code: "in_storage", label: "In storage" },
  { code: "under_repair", label: "Under repair" },
  { code: "missing", label: "Missing" },
  { code: "decommissioned", label: "Decommissioned" },
] as const;

/** Splits pasted or typed serials into lines: trims each, keeps line order,
 * and drops blank lines. Commas and tabs also separate, so a column pasted
 * from a spreadsheet works. */
export function splitSerials(text: string): string[] {
  return text
    .split(/[\n,\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pesos with thousands separators and 2 decimals: "₱248,600.00". */
export function formatPeso(amount: number | string | null | undefined): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Why a part can't be picked, as a short tag for its row and the full
 * sentence for a scan (rules 20 and 21, messages from context doc 13.2).
 * Null when it can go in.
 */
export function partBlockReason(item: InventoryItem, hostId?: number): { tag: string; message: string } | null {
  const name = itemDisplayName(item);
  if (!item.item_categories?.is_part) {
    return { tag: "Not a part", message: `${name} isn't a part. Only CPUs, GPUs, RAM and storage go inside a PC.` };
  }
  if (item.installed_in_item_id != null && item.installed_in_item_id === hostId) {
    return { tag: "In this PC", message: `${name} is already in this PC.` };
  }
  if (item.installed_in_item_id != null) {
    return {
      tag: `In PC #${item.installed_in_item_id}`,
      message: `${name} (#${item.id}) is installed in PC #${item.installed_in_item_id}. Remove it there first.`,
    };
  }
  if (item.currentCustody) {
    return { tag: `On ${item.currentCustody.mrNumber}`, message: `${name} is out on ${item.currentCustody.mrNumber}. Return it before installing it.` };
  }
  if (item.item_statuses?.code !== "in_storage") {
    const label = item.item_statuses?.label ?? "not in storage";
    return { tag: label, message: `${name} is ${label.toLowerCase()}. Only parts in storage can be installed.` };
  }
  return null;
}

/** What a known PAR looks like in one line: "Bacolod Tech Supply ·
 * received Sep 14, 2026 · 9 items so far". */
export function parSummary(par: Par): string {
  const count = par.itemCount ?? 0;
  return [
    par.supplier || "No supplier on record",
    `received ${formatCalendarDate(par.date_received)}`,
    count === 0 ? "no items yet" : `${count} item${count === 1 ? "" : "s"} so far`,
  ].join(" · ");
}

/** Parts in the order specs are read: CPU, GPU, RAM, storage, then by id. */
export function sortParts<T extends Pick<InventoryItem, "id" | "item_categories">>(parts: T[]): T[] {
  const rank = (p: T) => {
    const i = PART_CATEGORY_ORDER.indexOf(p.item_categories?.code ?? "");
    return i === -1 ? PART_CATEGORY_ORDER.length : i;
  };
  return [...parts].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}
