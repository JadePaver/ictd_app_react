import clsx from "clsx";
import { ROLE } from "../../lib/constants";
import { ShieldCheckIcon } from "../../components/ui/icons";

/**
 * A user's access level as a single fused two-way switch, not two separate
 * buttons — "Client" and "Operator" are mutually exclusive states of one
 * account property, so the control reads that way: one continuous pill with
 * no gap between its halves, the active half filled solid. The shield mark
 * on "Operator" is the only asymmetry, a quiet reminder that side grants
 * dashboard access instead of just describing a person.
 */
export function RoleToggle({
  value,
  onChange,
  disabled,
}: {
  value: number | null | undefined;
  onChange: (roleId: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        "inline-flex overflow-hidden rounded-full border border-[color:var(--border-hairline)]",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(ROLE.CLIENT)}
        className={clsx(
          "px-3 py-1.5 text-xs font-medium transition-colors",
          value === ROLE.CLIENT
            ? "bg-series-1 text-white"
            : "text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        )}
      >
        Client
      </button>
      <button
        type="button"
        onClick={() => onChange(ROLE.OPERATOR)}
        className={clsx(
          "flex items-center gap-1.5 border-l border-[color:var(--border-hairline)] px-3 py-1.5 text-xs font-medium transition-colors",
          value === ROLE.OPERATOR
            ? "bg-series-1 text-white"
            : "text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        )}
      >
        <ShieldCheckIcon size={13} />
        Operator
      </button>
    </div>
  );
}
