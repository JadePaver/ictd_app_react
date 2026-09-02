import type { ReactNode } from "react";
import clsx from "clsx";

type Tone = "neutral" | "good" | "warning" | "serious" | "critical" | "accent";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-black/5 text-ink-secondary dark:bg-white/10",
  good: "bg-good/10 text-good",
  warning: "bg-warning/15 text-[#8a5a00] dark:text-warning",
  serious: "bg-serious/15 text-[#9a3f1c] dark:text-serious",
  critical: "bg-critical/10 text-critical",
  accent: "bg-series-1/10 text-series-1",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}
