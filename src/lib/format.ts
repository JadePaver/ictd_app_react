/** Shared display formatting — used by the list pages and their detail modals
 * so name/date rendering stays identical across both. */

export function fullName(
  person: { first_name?: string | null; last_name?: string | null } | null | undefined,
  fallback = "—",
): string {
  if (!person) return fallback;
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return name || fallback;
}

export function formatDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString();
}

/** "Jul 22, 2026 · 3:37 PM". A spelled-out month can't be misread the way
 * 7/22 vs 22/7 can, the middot keeps the two halves scannable as separate
 * facts, and seconds are dropped — no screen here is precise to the second,
 * and ":22 PM" only competes with the minute that matters. */
export function formatDateTime(iso: string | null | undefined, fallback = "—"): string {
  return joinDateTime(iso, fallback, "medium");
}

/** The same shape one size down — "7/22/26 · 3:37 PM" — for slots too tight
 * for a spelled month, like the board's cards. */
export function formatDateTimeShort(iso: string | null | undefined, fallback = "—"): string {
  return joinDateTime(iso, fallback, "short");
}

function joinDateTime(
  iso: string | null | undefined,
  fallback: string,
  dateStyle: "medium" | "short",
): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  // Guarding here rather than letting `toLocale*` through: unguarded, a bad
  // timestamp renders the phrase twice ("Invalid Date · Invalid Date").
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.toLocaleDateString(undefined, { dateStyle })} · ${date.toLocaleTimeString(undefined, {
    timeStyle: "short",
  })}`;
}

/** e.g. 3.4 -> "3.4 hrs", 30 -> "1.3 days" — switches units past a day so the
 * dashboard's response-time KPI doesn't read as an implausible "48 hrs". */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function formatDays(days: number | null | undefined): string {
  if (days == null) return "—";
  return `${days.toFixed(1)} days`;
}

/** "3h ago", "2d ago" — reads faster than an absolute date in a queue an
 * operator is actively triaging. Past a week, "how many days ago" stops being
 * the useful signal, so the caller's `absolute` formatter takes over. */
function relativeTime(
  iso: string | null | undefined,
  fallback: string,
  absolute: (iso: string, fallback: string) => string,
): string {
  if (!iso) return fallback;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return fallback;
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return absolute(iso, fallback);
}

export function formatRelativeTime(iso: string | null | undefined, fallback = "—"): string {
  return relativeTime(iso, fallback, formatDate);
}

/** Same relative window as `formatRelativeTime`, but an entry that has aged out
 * of it keeps its clock time. A request's activity is read entry-by-entry — a
 * bare date can't separate an accept from the completion hours later that same
 * day, which is exactly what the log is consulted for. */
export function formatRelativeDateTime(iso: string | null | undefined, fallback = "—"): string {
  return relativeTime(iso, fallback, formatDateTimeShort);
}

/** "in 3h", "in 2d" — the future-facing counterpart to `formatRelativeTime`,
 * for a scheduled item that hasn't gone live yet. Falls back to `formatDate`
 * past a week, same cutoff as the past-facing version. */
export function formatCountdown(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return fallback;
  const minutes = Math.floor((then - Date.now()) / 60_000);
  if (minutes < 1) return "due now";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `in ${days}d`;
  return formatDate(iso, fallback);
}
