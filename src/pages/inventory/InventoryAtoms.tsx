import { useState, type ComponentType, type ReactNode } from "react";
import clsx from "clsx";
import { Avatar } from "../../components/ui/Avatar";
import {
  AlertTriangleIcon,
  BoxIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CpuIcon,
  GpuIcon,
  HardDriveIcon,
  HelpCircleIcon,
  KeyboardIcon,
  LaptopIcon,
  MemoryIcon,
  MinusCircleIcon,
  MonitorIcon,
  MouseIcon,
  PlugIcon,
  PrintIcon,
  ReceiptIcon,
  RouterIcon,
  TowerIcon,
  UserIcon,
  WarehouseIcon,
  WrenchIcon,
} from "../../components/ui/icons";
import { itemStatusTone, toneDotClass, toneTextClass, type Tone } from "../../lib/statusStyles";
import { dueInfo } from "../../lib/mrMetrics";
import { fullName } from "../../lib/format";
import { accountabilityTag, lineStatusLabel, lineStatusTone, mrStatusLabel, officeName } from "../../lib/inventory";
import type { Accountability, CustodianRef, Department, ItemStatusRef, MrStatus } from "../../types/api";

type IconType = ComponentType<{ size?: number; className?: string }>;

const CATEGORY_ICONS: Record<string, IconType> = {
  computer: LaptopIcon,
  monitor: MonitorIcon,
  keyboard: KeyboardIcon,
  mouse: MouseIcon,
  cpu: CpuIcon,
  gpu: GpuIcon,
  ram: MemoryIcon,
  storage: HardDriveIcon,
  printer: PrintIcon,
  networking: RouterIcon,
  peripheral: PlugIcon,
  other: BoxIcon,
};

const STATUS_ICONS: Record<string, IconType> = {
  in_storage: WarehouseIcon,
  in_use: UserIcon,
  under_repair: WrenchIcon,
  decommissioned: MinusCircleIcon,
  missing: HelpCircleIcon,
};

/** The category's mark in a soft tile, the item's "face" in lists. An
 * assembled PC shows a tower instead of the laptop. */
export function CategoryTile({
  code,
  size = 36,
  className,
  assembled,
}: {
  code: string | null | undefined;
  size?: number;
  className?: string;
  assembled?: boolean;
}) {
  const Icon = assembled ? TowerIcon : (CATEGORY_ICONS[code ?? ""] ?? BoxIcon);
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-black/[0.045] text-ink-secondary dark:bg-white/[0.07]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

export function CategoryGlyph({ code, size = 14, className }: { code: string | null | undefined; size?: number; className?: string }) {
  const Icon = CATEGORY_ICONS[code ?? ""] ?? BoxIcon;
  return <Icon size={size} className={className} />;
}

/**
 * An item's physical condition: a rounded pill with a status dot. Item
 * status and MR status are different vocabularies (context doc 15.8), so
 * this never looks like `MrStamp`.
 */
export function ItemStatusBadge({ status, withIcon }: { status: Pick<ItemStatusRef, "code" | "label"> | null | undefined; withIcon?: boolean }) {
  const tone = itemStatusTone(status?.code);
  const Icon = STATUS_ICONS[status?.code ?? ""];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        PILL_TONE[tone],
      )}
    >
      {withIcon && Icon ? <Icon size={12} /> : <span className={clsx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />}
      {status?.label ?? "Unknown"}
    </span>
  );
}

const PILL_TONE: Record<Tone, string> = {
  neutral: "bg-black/5 text-ink-secondary dark:bg-white/10",
  good: "bg-good/10 text-good",
  warning: "bg-warning/15 text-[#8a5a00] dark:text-warning",
  serious: "bg-serious/15 text-[#9a3f1c] dark:text-serious",
  critical: "bg-critical/10 text-critical",
  accent: "bg-series-1/10 text-series-1",
};

const STAMP_TONE: Record<MrStatus, string> = {
  active: "border-series-1/60 text-series-1",
  returned: "border-good/60 text-good",
  transferred: "border-ink-muted/50 text-ink-secondary",
};

/**
 * An MR's lifecycle state, drawn as a rubber stamp (square corners, spaced
 * capitals, an inked border) because an MR is a document you close, not a
 * record you edit.
 */
export function MrStamp({ status, className }: { status: MrStatus; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-[3px] border-[1.5px] px-1.5 py-[1px] font-mono text-[10px] leading-4 font-bold tracking-[0.14em] whitespace-nowrap uppercase",
        STAMP_TONE[status],
        className,
      )}
    >
      {mrStatusLabel(status)}
    </span>
  );
}

/** What happened to one item on one MR: "In custody", "Returned", "Transferred". */
export function LineStatus({ status }: { status: MrStatus }) {
  const tone = lineStatusTone(status);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", toneTextClass(tone))}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      {lineStatusLabel(status)}
    </span>
  );
}

/** Due state as text: an icon, the headline, and the relative half. */
export function DueLabel({
  mr,
  className,
  hideIcon,
}: {
  mr: { status: string; expected_return_at: string | null };
  className?: string;
  hideIcon?: boolean;
}) {
  const due = dueInfo(mr);
  const Icon = due.state === "overdue" ? AlertTriangleIcon : ClockIcon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", toneTextClass(due.tone), className)}>
      {hideIcon || due.state === "noDueDate" || due.state === "closed" ? null : <Icon size={13} className="shrink-0" />}
      <span>{due.label}</span>
      {due.detail ? <span className="font-normal opacity-80">· {due.detail}</span> : null}
    </span>
  );
}

/** A due state as a filled chip, for headers where it is the headline. */
export function DueChip({ mr }: { mr: { status: string; expected_return_at: string | null } }) {
  const due = dueInfo(mr);
  if (due.state === "closed") return null;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", PILL_TONE[due.tone])}>
      {due.state === "overdue" ? <AlertTriangleIcon size={12} /> : <ClockIcon size={12} />}
      {due.label}
      {due.detail ? <span className="font-medium opacity-85">· {due.detail}</span> : null}
    </span>
  );
}

/** Serial numbers are identifiers people read aloud and type: always mono. */
export function SerialTag({ value, copyable, className }: { value: string; copyable?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const body = (
    <>
      <span className="truncate">{value}</span>
      {copyable ? copied ? <CheckIcon size={11} className="shrink-0 text-good" /> : <CopyIcon size={11} className="shrink-0 opacity-60" /> : null}
    </>
  );
  const base = clsx(
    "inline-flex max-w-full items-center gap-1 rounded-md border border-[color:var(--border-hairline)] bg-black/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary dark:bg-white/[0.06]",
    className,
  );
  if (!copyable) return <span className={base}>{body}</span>;
  return (
    <button
      type="button"
      title="Copy serial number"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      className={clsx(base, "cursor-copy transition-colors hover:border-series-1/40 hover:text-ink")}
    >
      {body}
    </button>
  );
}

/** A person with an optional second line (employee number, office). */
export function PersonLine({
  person,
  sub,
  size = 28,
  className,
  strong,
}: {
  person: Pick<CustodianRef, "first_name" | "last_name"> | null | undefined;
  sub?: ReactNode;
  size?: number;
  className?: string;
  strong?: boolean;
}) {
  return (
    <span className={clsx("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar person={person} size={size} className={size < 30 ? "text-[10px]" : undefined} />
      <span className="min-w-0">
        <span className={clsx("block truncate text-sm", strong ? "font-semibold text-ink" : "text-ink")}>{fullName(person)}</span>
        {sub ? <span className="block truncate text-xs text-ink-muted">{sub}</span> : null}
      </span>
    </span>
  );
}

/** The custodian badge's accountability tag: N OVERDUE / N ON LOAN / CLEAR. */
export function AccountabilityBadge({ custodian, className }: { custodian: Partial<Accountability>; className?: string }) {
  const tag = accountabilityTag(custodian);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap",
        PILL_TONE[tag.tone],
        className,
      )}
    >
      {tag.tone === "critical" ? <AlertTriangleIcon size={10} /> : null}
      {tag.label}
    </span>
  );
}

/** An office name, title-cased for reading, with the stored label on hover. */
export function Office({ dept, fallback = "No office", className }: { dept: Department | null | undefined; fallback?: string; className?: string }) {
  if (!dept?.label) return <span className={clsx("text-ink-muted", className)}>{fallback}</span>;
  return (
    <span className={clsx("truncate", className)} title={dept.label}>
      {officeName(dept)}
    </span>
  );
}

/** One labelled fact in a detail view. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}

/** A small figure with its label, for the stat strips in detail views. */
export function Figure({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={clsx("mt-0.5 truncate text-lg font-semibold tabular-nums", tone ? toneTextClass(tone) : "text-ink")}>{value}</p>
      {hint ? <p className="truncate text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** A titled block inside a detail view. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A monospace identifier tag for PAR codes, the same look as a serial
 * (context doc v2, 11.4). Clickable when it leads somewhere. */
export function ParTag({ code, onClick, className }: { code: string; onClick?: () => void; className?: string }) {
  const base = clsx(
    "inline-flex max-w-full items-center gap-1 rounded-md border border-[color:var(--border-hairline)] bg-black/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary dark:bg-white/[0.06]",
    className,
  );
  const body = (
    <>
      <ReceiptIcon size={11} className="shrink-0 opacity-70" />
      <span className="truncate">{code}</span>
    </>
  );
  if (!onClick) return <span className={base}>{body}</span>;
  return (
    <button
      type="button"
      title={`Open ${code}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(base, "cursor-pointer transition-colors hover:border-series-1/40 hover:text-ink")}
    >
      {body}
    </button>
  );
}

/**
 * Where a part sits: "Installed in PC #223". Placement is not condition,
 * so this is always a neutral chip, never a status colour (v2, 11.4).
 */
export function PlacementChip({
  hostId,
  onOpen,
  label,
  className,
}: {
  hostId: number;
  /** Opens the PC. Without it the chip is plain text. */
  onOpen?: (hostId: number) => void;
  /** Defaults to "Installed in PC #id"; lists use the short "In PC #id". */
  label?: string;
  className?: string;
}) {
  const text = label ?? `Installed in PC #${hostId}`;
  const base = clsx(
    "inline-flex items-center gap-1 rounded-full border border-[color:var(--border-hairline)] bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-ink-secondary dark:bg-white/[0.06]",
    className,
  );
  const body = (
    <>
      <TowerIcon size={11} className="shrink-0 opacity-70" />
      {text}
    </>
  );
  if (!onOpen) return <span className={base}>{body}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(hostId);
      }}
      className={clsx(base, "cursor-pointer transition-colors hover:border-series-1/40 hover:text-ink")}
      title={`Open PC #${hostId}`}
    >
      {body}
    </button>
  );
}

/** A short uppercase category tag ("GPU", "RAM") for part rows, or a
 * reason a part can't be picked. */
export function CategoryTag({ label, className }: { label: string | null | undefined; className?: string }) {
  if (!label) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-[1px] text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase",
        "bg-black/[0.05] text-ink-secondary dark:bg-white/[0.08]",
        className,
      )}
    >
      {label}
    </span>
  );
}
