import type { ComponentType } from "react";
import { colorForString } from "../../components/ui/Avatar";
import { BuildingIcon, IdCardIcon, QrCodeIcon, TransferIcon, UsersIcon } from "../../components/ui/icons";
import type { DepartmentStats } from "../../types/api";

function StatCell({
  icon: Icon,
  value,
  label,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 bg-surface px-2 py-3.5">
      <Icon size={15} className="text-ink-muted" />
      <span className="text-lg font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-[10px] text-ink-muted">{label}</span>
    </div>
  );
}

/**
 * A department as an office directory plaque — a solid-color nameplate (the
 * kind mounted outside a department's door, or listed on a building lobby
 * directory board) sitting above a 2x2 headcount/custody scorecard. The
 * plaque color is derived from the department's own label via
 * `colorForString`, the same categorical-palette trick `Avatar` uses for
 * people, so every department reads as a distinct "wing" of the org chart
 * without a stored color column. The four stats reuse the exact nav icons
 * their destinations use elsewhere (Users/Inventory/Custodians/MR), so a
 * glance at a card's icon already tells you which page a number belongs to.
 */
export function DepartmentCard({
  label,
  code,
  stats,
  onViewEmployees,
  onEdit,
}: {
  label: string;
  code: string | null;
  stats: DepartmentStats | undefined;
  onViewEmployees: () => void;
  onEdit: () => void;
}) {
  const color = colorForString(label);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-surface transition-shadow hover:shadow-md">
      <div className="relative px-4 py-3.5" style={{ backgroundColor: color }}>
        <div className="flex items-center gap-2.5 pr-12">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
            <BuildingIcon size={17} />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{label}</p>
        </div>
        {code ? (
          <span className="absolute top-3.5 right-4 rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-white">
            {code}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-px bg-[color:var(--gridline)]">
        <StatCell icon={UsersIcon} value={stats?.employeeCount ?? 0} label="Employees" />
        <StatCell icon={QrCodeIcon} value={stats?.inventoryItemCount ?? 0} label="Inventory" />
        <StatCell icon={IdCardIcon} value={stats?.custodianCount ?? 0} label="Custodians" />
        <StatCell icon={TransferIcon} value={stats?.activeMrCount ?? 0} label="Active MRs" />
      </div>

      <div className="mt-auto flex border-t border-[color:var(--border-hairline)]">
        <button
          type="button"
          onClick={onViewEmployees}
          className="flex-1 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
        >
          View employees
        </button>
        <div className="w-px bg-[color:var(--border-hairline)]" />
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 px-3 py-2 text-xs font-medium text-series-1 transition-colors hover:bg-series-1/5"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
