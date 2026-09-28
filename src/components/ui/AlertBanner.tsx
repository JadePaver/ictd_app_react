import type { ComponentType, ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangleIcon } from "./icons";

/**
 * A standing alert for a liability (missing items, overdue MRs, overdue
 * custodians). It stays put until the underlying state changes, and offers a
 * single action that applies the matching filter, so "what's wrong" and
 * "show me" are one click apart.
 */
export function AlertBanner({
  title,
  children,
  action,
  tone = "critical",
  icon: Icon = AlertTriangleIcon,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "critical" | "warning";
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div
      role="status"
      className={clsx(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3",
        tone === "critical" ? "border-critical/25 bg-critical/[0.07]" : "border-warning/35 bg-warning/[0.09]",
      )}
    >
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          tone === "critical" ? "bg-critical/15 text-critical" : "bg-warning/20 text-[#8a5a00] dark:text-warning",
        )}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx("text-sm font-semibold", tone === "critical" ? "text-critical" : "text-[#8a5a00] dark:text-warning")}>
          {title}
        </p>
        {children ? <p className="text-sm text-ink-secondary">{children}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
