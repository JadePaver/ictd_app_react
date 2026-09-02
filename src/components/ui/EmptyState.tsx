import type { ComponentType, ReactNode } from "react";
import { AlertTriangleIcon, InboxIcon } from "./icons";

export function EmptyState({
  title,
  hint,
  action,
  icon: Icon = InboxIcon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted dark:bg-white/[0.06]">
        <Icon size={20} />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-critical/10 text-critical">
        <AlertTriangleIcon size={20} />
      </div>
      <p className="text-sm font-medium text-critical">Something went wrong</p>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
    </div>
  );
}
