import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_STYLES: Record<Variant, string> = {
  // Hover darkens the actual fill (color-mix toward black) rather than
  // dropping opacity — opacity lets the page bleed through and washes the
  // label out, especially over busy backgrounds.
  primary:
    "bg-series-1 text-white shadow-sm hover:bg-[color-mix(in_oklab,var(--series-1)_88%,black)] disabled:opacity-50",
  secondary:
    "bg-transparent border border-[color:var(--border-hairline)] text-ink hover:bg-black/[0.03] dark:hover:bg-white/[0.06] disabled:opacity-50",
  danger:
    "bg-critical text-white shadow-sm hover:bg-[color-mix(in_oklab,var(--status-critical)_88%,black)] disabled:opacity-50",
  ghost: "bg-transparent text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06] disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}
