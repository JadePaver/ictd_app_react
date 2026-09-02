import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type SVGProps,
} from "react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { SnackbarStack, type SnackbarData } from "../components/ui/Snackbar";
import { QrCodeIcon, ShieldCheckIcon, TicketIcon, TransferIcon, WrenchIcon } from "../components/ui/icons";
import ictdSeal from "../assets/ictd-seal.png";
import serverIllustration from "../assets/server-illustration.svg";
import googleIcon from "../assets/google-icon.png";

type IconComponent = (props: SVGProps<SVGSVGElement> & { size?: number }) => ReactElement;

/**
 * A circular badge that bobs in place and, on hover, holds a single
 * expanding hairline ring (a one-shot grow, not a repeating pulse — plain
 * `transition`, not `animate-ping`) — a little "system is alive" flourish
 * scattered around the sign-in card. The background circle and the ring are
 * separate absolutely-positioned layers from the icon, so hover scales only
 * the background/ring — the icon itself stays a fixed size. Both use a
 * "back out" cubic-bezier (overshoots past its target before settling) so
 * the pop feels quick and springy rather than a smooth, generic ease.
 *
 * `variant="shrink"` inverts the *ring* only: it starts already expanded
 * and visible, then pulls back in on hover — one badge in the group reads
 * as "settling" instead of "firing outward" so they're not all doing the
 * same thing. The background circle and icon behave identically regardless
 * of variant.
 *
 * Position it with `className` (e.g. `top-[14%] right-[14%]`); the parent
 * must be `relative`.
 *
 * Also doubles as a button: `cursor-pointer` plus `role="button"` signal
 * it's clickable, and clicking (or Enter/Space when focused) fires `onClick`
 * — the sign-in page uses this to pop a snackbar describing the feature.
 */
function FloatingBadge({
  icon: Icon,
  size = 64,
  className,
  style,
  variant = "grow",
  label,
  onClick,
}: {
  icon: IconComponent;
  size?: number;
  className?: string;
  style?: CSSProperties;
  variant?: "grow" | "shrink";
  label: string;
  onClick?: () => void;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <div
      className={clsx("group absolute cursor-pointer", className)}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="relative [animation:float-badge_6s_ease-in-out_infinite]" style={{ width: size, height: size }}>
        {/* True sub-pixel hairline: CSS `border-width` gets snapped to a
            whole device pixel by the browser. An SVG stroke avoids that, but
            only if the ring grows via real geometry (the circle's `r`) —
            growing it with a CSS `transform: scale()` instead drags the
            stroke width along with it (`non-scaling-stroke` only cancels the
            SVG's own internal viewBox scaling, not an outer CSS transform),
            which is exactly what made it look thick again at the bigger
            hover size. */}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <circle
            cx="50"
            cy="50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
            className={clsx(
              "text-series-1/70 transition-[r,opacity] duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              variant === "grow"
                ? "[r:49.5] opacity-0 group-hover:[r:195] group-hover:opacity-100"
                : // Background circle grows to scale-[1.9] on hover (r≈95 in
                  // this same 100-unit viewBox), so the ring can't shrink
                  // past that or it'd end up hidden behind the now-bigger
                  // background — 160 keeps it comfortably outside, still
                  // visible, while staying below the resting 195 so it
                  // still reads as "shrinking" on hover.
                  "[r:195] opacity-100 group-hover:[r:160]",
            )}
          />
        </svg>
        <span className="absolute inset-0 scale-100 rounded-full bg-series-1/20 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-[1.9]" />
        <div className="relative flex h-full w-full items-center justify-center">
          <Icon size={Math.round(size * 0.4)} className="text-series-1" />
        </div>
      </div>
    </div>
  );
}

// Lazy-loaded so the particle-animation library only ever gets fetched by
// signed-out visitors on this page, not bundled into the authenticated
// dashboard's main chunk.
const ParticlesBackground = lazy(() =>
  import("../components/ui/ParticlesBackground").then((m) => ({ default: m.ParticlesBackground })),
);

const FEATURES = [
  { icon: QrCodeIcon, label: "QR-labeled inventory" },
  { icon: TransferIcon, label: "Full custody & MR chain" },
  { icon: WrenchIcon, label: "Repair & maintenance logs" },
  { icon: TicketIcon, label: "Technical request intake" },
];

// The floating badges scattered around the sign-in card are clickable —
// each opens a snackbar naming the feature it represents.
const BADGE_FEATURES: Array<{
  icon: IconComponent;
  size: number;
  variant?: "grow" | "shrink";
  className: string;
  animationDelay: string;
  title: string;
  description: string;
}> = [
  {
    icon: ShieldCheckIcon,
    size: 78,
    className: "top-[14%] right-[14%]",
    animationDelay: "0s",
    title: "Secure sign-in",
    description:
      "Access is limited to verified ICTD operator accounts through Google Workspace — no separate passwords to manage.",
  },
  {
    icon: QrCodeIcon,
    size: 66,
    className: "top-1/2 left-[8%] -translate-y-1/2",
    animationDelay: "1.6s",
    title: "QR-labeled inventory",
    description: "Every asset carries a scannable QR code for instant lookup, check-in, and check-out in the field.",
  },
  {
    icon: TransferIcon,
    size: 72,
    variant: "shrink",
    className: "bottom-[16%] right-[18%]",
    animationDelay: "3.1s",
    title: "Full custody & MR chain",
    description:
      "Transfers between offices and personnel are logged with a memorandum receipt, keeping custody history traceable end to end.",
  },
];

const GRID_SIZE = "36px 36px";
const BASE_GRID_IMAGE =
  "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)";
const LIT_GRID_IMAGE =
  "linear-gradient(rgba(134,255,193,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(134,255,193,0.55) 1px, transparent 1px)";

// Spring constants for the spotlight's chase of the cursor: each frame it
// accelerates toward the target (proportional to distance, like a spring)
// and that velocity is damped, rather than the light just snapping straight
// to the pointer position.
const SPRING_STIFFNESS = 0.05;
const SPRING_DAMPING = 0.75;

/**
 * The brand panel is deliberately dark regardless of the dashboard's own
 * light/dark theme — a fixed "console" surface (like a terminal or ops
 * dashboard) rather than themed content, matching the technical-office tone
 * the rest of this page is going for.
 *
 * The grid has two overlaid copies: a dim base grid, and a brighter copy
 * clipped to a circular `mask-image` centered on `--spot-x`/`--spot-y`. A
 * pointermove only updates the *target* the light is chasing; a rAF loop
 * eases the actual `--spot-x`/`--spot-y` toward that target with a light
 * spring (see SPRING_* above) so the light visibly accelerates and glides
 * into place instead of teleporting to the cursor every frame. Position is
 * pushed straight onto the DOM node (not React state) to stay at
 * pointermove/rAF frequency without a re-render per frame.
 */
function BrandPanel() {
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = requestAnimationFrame(function tick() {
      rafId = requestAnimationFrame(tick);
      const panel = panelRef.current;
      const current = currentRef.current;
      const target = targetRef.current;
      const velocity = velocityRef.current;

      velocity.x = (velocity.x + (target.x - current.x) * SPRING_STIFFNESS) * SPRING_DAMPING;
      velocity.y = (velocity.y + (target.y - current.y) * SPRING_STIFFNESS) * SPRING_DAMPING;
      current.x += velocity.x;
      current.y += velocity.y;

      panel?.style.setProperty("--spot-x", `${current.x}px`);
      panel?.style.setProperty("--spot-y", `${current.y}px`);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    targetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerEnter(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Snap straight to the entry point (no travel) so only movement *after*
    // arriving gets the springy chase — otherwise the light would visibly
    // fly in from wherever it last parked, every time the cursor re-enters.
    targetRef.current = point;
    currentRef.current = point;
    velocityRef.current = { x: 0, y: 0 };
    e.currentTarget.style.setProperty("--spot-x", `${point.x}px`);
    e.currentTarget.style.setProperty("--spot-y", `${point.y}px`);
    e.currentTarget.style.setProperty("--spot-opacity", "1");
  }

  return (
    <div
      ref={panelRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={(e) => e.currentTarget.style.setProperty("--spot-opacity", "0")}
      className="relative hidden w-full max-w-[560px] flex-col justify-between overflow-hidden px-12 py-12 lg:flex"
      style={{ background: "linear-gradient(160deg, #08150e 0%, #06100b 45%, #030906 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: BASE_GRID_IMAGE, backgroundSize: GRID_SIZE }} />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out"
        style={{
          backgroundImage: LIT_GRID_IMAGE,
          backgroundSize: GRID_SIZE,
          opacity: "var(--spot-opacity, 0)",
          WebkitMaskImage: "radial-gradient(220px at var(--spot-x, 50%) var(--spot-y, 50%), black 0%, transparent 72%)",
          maskImage: "radial-gradient(220px at var(--spot-x, 50%) var(--spot-y, 50%), black 0%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--series-1) 0%, transparent 70%)" }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={ictdSeal} className="h-9 w-9" alt="" />
          <div>
            <p className="text-sm font-semibold text-white">ICTD App</p>
            <p className="text-[11px] font-medium tracking-wider text-white/50 uppercase">Admin Console</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-series-1 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-series-1" />
          </span>
          <span className="font-mono text-[10px] font-medium tracking-wide text-white/70">SYSTEM OPERATIONAL</span>
        </div>
      </div>

      <div className="relative flex flex-col gap-8">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold text-white xl:text-[32px]">
            Asset &amp; custody management for ICTD.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            Serial-tracked inventory, memorandum receipts, and technical service records — one system of record for
            the division.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#f7f7f5] shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-black/5 bg-black/[0.03] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ec6a5e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f4bf4f]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#61c454]" />
            <span className="ml-2 font-mono text-[10px] text-black/40">asset-network.sys</span>
          </div>
          <img src={serverIllustration} alt="" className="h-52 w-full object-contain p-6" />
        </div>

        <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
          {FEATURES.map((f) => (
            <li key={f.label} className="flex items-center gap-2 text-xs text-white/70">
              <f.icon size={14} className="shrink-0 text-series-1" />
              {f.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative font-mono text-[11px] text-white/35">Information &amp; Communications Technology Division</p>
    </div>
  );
}

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const { theme } = useTheme();
  const [snackbars, setSnackbars] = useState<SnackbarData[]>([]);

  function showSnackbar(data: Omit<SnackbarData, "id">) {
    setSnackbars((prev) => [{ id: Date.now() + Math.random(), ...data }, ...prev]);
  }

  function dismissSnackbar(id: number) {
    setSnackbars((prev) => prev.filter((item) => item.id !== id));
  }

  // When the OAuth flow fails server-side, Supabase redirects back here with
  // error/error_description in the query or hash — without this the failure
  // is invisible: the app just lands back on this page with no explanation.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description =
      search.get("error_description") ?? hash.get("error_description") ?? search.get("error") ?? hash.get("error");
    if (description) {
      showSnackbar({ title: "Sign-in failed", description, icon: ShieldCheckIcon });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="relative flex min-h-screen bg-page">
      <ThemeToggle className="absolute top-4 right-4 z-10 h-9 w-9" />
      <BrandPanel />

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
        {/* Faint green grid texture — the right panel is otherwise a flat
            near-white surface in light mode; this reads as abstract
            structure/noise without competing with the card or particles.
            Built from `color-mix` against `--series-1` so it auto-adapts to
            the theme's own green instead of a hand-picked hex per mode. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in srgb, var(--series-1) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--series-1) 7%, transparent) 1px, transparent 1px)",
            backgroundSize: GRID_SIZE,
          }}
        />
        <div
          className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full opacity-[0.22] blur-3xl dark:opacity-25"
          style={{ background: "radial-gradient(circle, var(--series-1) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full opacity-[0.18] blur-3xl dark:opacity-20"
          style={{ background: "radial-gradient(circle, var(--series-1) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute top-[38%] -left-28 h-60 w-60 -translate-y-1/2 rounded-full opacity-[0.16] blur-3xl dark:opacity-[0.18]"
          style={{ background: "radial-gradient(circle, var(--series-1) 0%, transparent 70%)" }}
        />
        <Suspense fallback={null}>
          <ParticlesBackground dark={theme === "dark"} className="pointer-events-none absolute inset-0" />
        </Suspense>

        {BADGE_FEATURES.map((feature) => (
          <FloatingBadge
            key={feature.title}
            icon={feature.icon}
            size={feature.size}
            variant={feature.variant}
            className={feature.className}
            style={{ animationDelay: feature.animationDelay }}
            label={feature.title}
            onClick={() =>
              showSnackbar({
                title: feature.title,
                description: feature.description,
                icon: feature.icon,
              })
            }
          />
        ))}

        <div className="relative z-10 mb-6 flex items-center gap-2.5 lg:hidden">
          <img src={ictdSeal} alt="ICTD — Information and Communications Technology Division" className="h-9 w-9" />
          <div>
            <p className="text-sm font-semibold text-ink">ICTD App</p>
            <p className="text-[11px] font-medium tracking-wider text-ink-muted uppercase">Admin Console</p>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[color:var(--border-hairline)] bg-surface/5 p-8 shadow-xl backdrop-blur-[2px] backdrop-saturate-150">
          <p className="text-xl font-semibold text-ink">Sign in</p>
          <p className="mt-1 mb-7 text-sm text-ink-muted">Use your ICTD Google Workspace account to continue.</p>

          <button
            onClick={() =>
              signInWithGoogle().catch((err: Error) =>
                showSnackbar({ title: "Sign-in failed", description: err.message, icon: ShieldCheckIcon }),
              )
            }
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#1f1f1f] shadow-sm transition-shadow hover:shadow-md active:shadow-none dark:border-white/15"
          >
            <img src={googleIcon} alt="" className="h-[18px] w-[18px]" />
            Sign in with Google
          </button>

          <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-series-1/8 p-3">
            <ShieldCheckIcon size={16} className="mt-0.5 shrink-0 text-series-1" />
            <p className="text-xs text-ink-secondary">
              Sign in with the same Google account you use for the ICTD App. Only operator (ICTD staff) accounts can
              access this dashboard.
            </p>
          </div>
        </div>

        <p className="relative z-10 mt-8 text-center font-mono text-[11px] text-ink-muted/70 lg:hidden">
          Information &amp; Communications Technology Division
        </p>
      </div>

      {/* `lg:left-[560px]` matches BrandPanel's `max-w-[560px]` so the stack
          centers within the right-hand panel only, not the whole viewport. */}
      <SnackbarStack items={snackbars} onDismiss={dismissSnackbar} className="lg:left-[560px]" />
    </div>
  );
}
