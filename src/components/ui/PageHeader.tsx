import type { ReactNode } from "react";

/** Title, one line of context, and the page's primary actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {/* Actions wrap under the title on a phone instead of running off the edge. */}
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0">{actions}</div> : null}
    </div>
  );
}
