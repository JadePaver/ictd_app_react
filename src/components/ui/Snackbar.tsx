import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { XIcon } from "./icons";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export type SnackbarData = {
  /** Unique per toast so several can be stacked and dismissed independently. */
  id: number;
  title: string;
  description: string;
  icon?: IconComponent;
};

const GAP = 12;
// How far above its resting slot a toast starts before sliding down into
// place — large enough to read as a deliberate slide, not a fade-in-place.
const ENTER_OFFSET = 56;

/**
 * One toast in the stack. Position is a `translateY` driven by `top` (its
 * measured slot in the stack, supplied by the parent) rather than normal
 * document flow, so both its own entrance/exit *and* every reshuffle caused
 * by siblings mounting/unmounting animate through the same `transition` —
 * nothing snaps.
 */
function SnackbarItem({
  data,
  top,
  onDismiss,
  duration,
  registerRef,
}: {
  data: SnackbarData;
  top: number;
  onDismiss: (id: number) => void;
  duration: number;
  registerRef: (id: number, el: HTMLDivElement | null) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => setVisible(false), duration);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(timer);
    };
  }, [duration]);

  const Icon = data.icon;

  return (
    <div
      ref={(el) => registerRef(data.id, el)}
      // Repositioning (a sibling mounting/unmounting) also ends a
      // `transform` transition, so only treat this as "finished closing"
      // when we're actually mid-exit — otherwise a mere reshuffle would
      // dismiss the toast early.
      onTransitionEnd={(e) => {
        if (e.propertyName === "transform" && !visible) onDismiss(data.id);
      }}
      style={{ transform: `translateY(${top + (visible ? 0 : -ENTER_OFFSET)}px)` }}
      className={clsx(
        "pointer-events-auto absolute inset-x-0 flex items-start gap-3 rounded-xl border border-[color:var(--border-hairline)] bg-surface/95 p-4 shadow-2xl backdrop-blur-xl backdrop-saturate-150 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "opacity-100" : "opacity-0",
      )}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <span className="mt-0.5 shrink-0 text-series-1">
          <Icon size={18} />
        </span>
      )}
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">{data.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{data.description}</p>
      </div>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-ink-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

/**
 * A top-anchored, centered stack of toasts. Newest is prepended, landing in
 * the top slot and easing the rest of the stack down to make room. Slot
 * offsets come from each toast's *measured* height (via `registerRef` +
 * `useLayoutEffect`, re-run whenever `items` changes) rather than normal
 * flex flow, because flow-based reflow snaps instantly — a transform can be
 * transitioned, a flex position can't.
 */
export function SnackbarStack({
  items,
  onDismiss,
  duration = 5000,
  className,
}: {
  items: SnackbarData[];
  onDismiss: (id: number) => void;
  duration?: number;
  /** Extra classes on the fixed positioning wrapper — use to constrain the
   * horizontal region it centers within (e.g. `lg:left-[560px]` to exclude a
   * sidebar) instead of the full viewport width. */
  className?: string;
}) {
  const heightsRef = useRef<Record<number, number>>({});
  const elsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const [, forceRender] = useState(0);

  useLayoutEffect(() => {
    let changed = false;
    for (const item of items) {
      const el = elsRef.current[item.id];
      if (el && heightsRef.current[item.id] !== el.offsetHeight) {
        heightsRef.current[item.id] = el.offsetHeight;
        changed = true;
      }
    }
    if (changed) forceRender((n) => n + 1);
  }, [items]);

  if (items.length === 0) return null;

  let offset = 0;
  const positioned = items.map((item) => {
    const top = offset;
    offset += (heightsRef.current[item.id] ?? 80) + GAP;
    return { item, top };
  });

  return createPortal(
    <div className={clsx("pointer-events-none fixed inset-x-0 top-8 z-50 flex justify-center px-4", className)}>
      <div className="relative w-full max-w-md">
        {positioned.map(({ item, top }) => (
          <SnackbarItem
            key={item.id}
            data={item}
            top={top}
            onDismiss={onDismiss}
            duration={duration}
            registerRef={(id, el) => {
              elsRef.current[id] = el;
            }}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
