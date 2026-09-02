import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronDownIcon, XIcon } from "./icons";

/** `label` is nullable because several reference tables type it that way —
 * a null label renders and matches as an em dash. */
export type ComboboxOption = { value: number; label: string | null };

const LIST_MAX_HEIGHT = 260;

/**
 * Searchable replacement for every native `<select>` in the app: an input
 * that filters the option list as you type (WAI-ARIA combobox pattern —
 * `role="combobox"`, `aria-activedescendant`, arrow-key navigation).
 *
 * The option list renders through a portal at `document.body` with a
 * position measured off the input, because several call sites live inside
 * `overflow-hidden` Cards or scrolling modals where an absolutely-positioned
 * sibling would be clipped. The portal re-measures on scroll/resize and
 * flips upward when there's no room below.
 *
 * Selection semantics match the `<select>`s this replaces: `value` is the
 * selected option's numeric id (or ""/null/undefined for "none"), and
 * `onChange` emits `number | undefined` — callers using a `""` sentinel map
 * it back with `v ?? ""`. Clearing (the ✕ button, or emptying the text and
 * committing with Enter/blur) emits `undefined`; Escape reverts instead of
 * clearing. Escape also stops propagation while the list is open so it
 * closes just the list, not the Modal above it.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  clearable = true,
  disabled,
  autoFocus,
  onBlur,
  className,
}: {
  id?: string;
  value: number | "" | null | undefined;
  onChange: (value: number | undefined) => void;
  options: ComboboxOption[];
  /** Shown when nothing is selected — plays the role of the old empty
   * `<option>` label ("All departments", "No department", "Select…"). */
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  /** Width/layout classes for the wrapper (defaults to full width). */
  className?: string;
}) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // null = not editing (input mirrors the selected label); a string = the
  // user's in-progress filter text, which never overwrites the selection
  // until they commit.
  const [query, setQuery] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [placement, setPlacement] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const selected = typeof value === "number" ? (options.find((o) => o.value === value) ?? null) : null;
  const displayText = query ?? selected?.label ?? "";

  const filtered = useMemo(() => {
    const q = query?.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.label ?? "—").toLowerCase().includes(q));
  }, [options, query]);

  function measure() {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const openUp = rect.bottom + LIST_MAX_HEIGHT + 8 > window.innerHeight && rect.top > LIST_MAX_HEIGHT + 8;
    setPlacement({ top: openUp ? rect.top - 4 : rect.bottom + 4, left: rect.left, width: rect.width, openUp });
  }

  function openList() {
    if (disabled || open) return;
    measure();
    const idx = filtered.findIndex((o) => o.value === selected?.value);
    setHighlighted(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function closeList(revert: boolean) {
    setOpen(false);
    if (revert) {
      setQuery(null);
    } else if (query === "" && clearable) {
      // The user deliberately emptied the box — that's a clear, mirroring
      // the old empty <option>.
      onChange(undefined);
      setQuery(null);
    } else {
      setQuery(null);
    }
  }

  function select(option: ComboboxOption) {
    onChange(option.value);
    setQuery(null);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!wrapperRef.current?.contains(target) && !listRef.current?.contains(target)) {
        closeList(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`#${CSS.escape(`${listboxId}-${highlighted}`)}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted, listboxId]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (filtered.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setHighlighted((h) => (h + delta + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      if (!open) return; // closed → let forms submit normally
      e.preventDefault();
      if (query === "" && clearable) {
        onChange(undefined);
        setQuery(null);
        setOpen(false);
      } else if (filtered[highlighted]) {
        select(filtered[highlighted]);
      }
    } else if (e.key === "Escape") {
      if (!open) return; // closed → let the Modal above handle it
      e.preventDefault();
      e.stopPropagation();
      closeList(true);
    } else if (e.key === "Tab") {
      if (open) closeList(false);
    }
  }

  return (
    <div ref={wrapperRef} className={clsx("relative", className ?? "w-full")}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlighted] ? `${listboxId}-${highlighted}` : undefined}
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
        value={displayText}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          if (!open) openList();
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Option rows preventDefault on mousedown, so focus only truly
          // leaves when the user moves on — commit any pending edit then.
          if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
            if (open) closeList(false);
            else setQuery(null);
            onBlur?.();
          }
        }}
        className="w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent py-2 pr-14 pl-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
        {clearable && selected && !disabled ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(undefined);
              setQuery(null);
              inputRef.current?.focus();
            }}
            className="rounded p-0.5 text-ink-muted hover:text-ink"
          >
            <XIcon size={13} />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close options" : "Show options"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              closeList(false);
            } else {
              inputRef.current?.focus();
              openList();
            }
          }}
          className="rounded p-0.5 text-ink-muted hover:text-ink"
          disabled={disabled}
        >
          <ChevronDownIcon size={14} className={clsx("transition-transform duration-150", open && "rotate-180")} />
        </button>
      </div>

      {open && placement
        ? createPortal(
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              style={{
                top: placement.top,
                left: placement.left,
                width: placement.width,
                maxHeight: LIST_MAX_HEIGHT,
                transform: placement.openUp ? "translateY(-100%)" : undefined,
              }}
              className="fixed z-[60] overflow-y-auto rounded-lg border border-[color:var(--border-hairline)] bg-surface py-1 shadow-xl [animation:modal-backdrop-in_120ms_ease-out]"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-ink-muted">No matches</li>
              ) : (
                filtered.map((option, index) => (
                  <li
                    key={option.value}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={option.value === selected?.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(option)}
                    onMouseMove={() => setHighlighted(index)}
                    className={clsx(
                      "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                      index === highlighted ? "bg-series-1/10 text-ink" : "text-ink-secondary",
                    )}
                  >
                    <span className="truncate">{option.label ?? "—"}</span>
                    {option.value === selected?.value ? <span className="shrink-0 text-series-1">✓</span> : null}
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
