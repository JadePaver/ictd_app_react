import clsx from "clsx";

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

/** Simple deterministic string hash (djb2-ish) — same person always lands
 * on the same series color, without a stored color column anywhere. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

type PersonLike = { first_name?: string | null; last_name?: string | null } | null | undefined;

/** The series color any string identity resolves to — same categorical
 * palette and hash everywhere, so "give this a consistent brand color"
 * never needs a second implementation. Keyed by department label
 * (DepartmentCard) as well as by person name (personColor below). */
export function colorForString(key: string): string {
  return SERIES_COLORS[hashString(key || "unknown") % SERIES_COLORS.length];
}

/** The series color a person's identity resolves to — same derivation
 * Avatar uses internally, exported so anything else needing a person's
 * "brand color" (CustodianBadgeCard's header band) stays visually
 * consistent with their avatar instead of picking its own palette. */
export function personColor(person: PersonLike): string {
  const name = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim();
  return colorForString(name);
}

/**
 * Colored-initials avatar for a person — custodians, requesters, operators.
 * Color is derived from their name via `SERIES_COLORS` (the same validated
 * ICTD-brand categorical palette charts use), so every person gets a
 * consistent, visually distinct identity without inventing a new palette.
 */
export function Avatar({ person, size = 32, className }: { person: PersonLike; size?: number; className?: string }) {
  const firstInitial = person?.first_name?.trim()?.[0] ?? "";
  const lastInitial = person?.last_name?.trim()?.[0] ?? "";
  const initials = (firstInitial + lastInitial).toUpperCase() || "?";
  const color = personColor(person);

  return (
    <span
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
        color,
      }}
    >
      {initials}
    </span>
  );
}
