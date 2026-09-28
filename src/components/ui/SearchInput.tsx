import { useEffect, useRef } from "react";
import clsx from "clsx";
import { SearchIcon, XIcon } from "./icons";
import { fieldInputClass } from "./FormField";

/**
 * Search box with a clear button. With `shortcut`, pressing "/" anywhere on
 * the page (outside another field) focuses it, the convention most admin
 * tools share, and the key is shown as a hint while the box is empty.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  shortcut,
  autoFocus,
  className,
  id,
  ariaLabel,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  shortcut?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
  /** Marks the box red, for a picker whose selection is what's missing. */
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']");
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  return (
    <div className={clsx("relative", className)}>
      <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Filtering is live, so Enter has nothing to submit. Inside a
          // larger form (the MR dialogs) it would otherwise submit that.
          if (e.key === "Enter") e.preventDefault();
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        className={clsx(fieldInputClass, "pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/[0.08]"
        >
          <XIcon size={13} />
        </button>
      ) : shortcut ? (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-[color:var(--border-hairline)] px-1.5 font-mono text-[10px] text-ink-muted sm:block">
          /
        </kbd>
      ) : null}
    </div>
  );
}
