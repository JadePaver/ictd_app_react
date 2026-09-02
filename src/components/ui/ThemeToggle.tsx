import clsx from "clsx";
import { useTheme } from "../../context/ThemeContext";
import { MoonIcon, SunIcon } from "./icons";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={clsx(
        "flex items-center justify-center rounded-lg text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}
