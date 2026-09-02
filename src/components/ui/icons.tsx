import { useId, type SVGProps } from "react";

/**
 * Hand-picked Lucide icon paths (ISC license, https://lucide.dev), inlined
 * as plain components instead of importing from `lucide-react` — that
 * package's barrel export doesn't tree-shake under this project's bundler,
 * so a static `import { X } from "lucide-react"` pulls in its entire
 * ~4,000-icon set (a ~500KB gzip regression for 4 icons).
 */
type IconProps = SVGProps<SVGSVGElement>;

function createIcon(paths: string[]) {
  return function Icon({ size = 16, strokeWidth = 2, ...props }: IconProps & { size?: number }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };
}

export const ChevronRightIcon = createIcon(["m9 18 6-6-6-6"]);
export const ChevronLeftIcon = createIcon(["m15 18-6-6 6-6"]);
export const ChevronUpIcon = createIcon(["m18 15-6-6-6 6"]);
export const ChevronDownIcon = createIcon(["m6 9 6 6 6-6"]);

export const XIcon = createIcon(["M18 6 6 18", "m6 6 12 12"]);

/** Two small chevrons (built from primitives, not a memorized glyph — see
 * the Sun/Moon note above) used as the "unsorted column" affordance. */
export const SortIcon = createIcon(["M8 10l4-4 4 4", "M8 14l4 4 4-4"]);

/** Two opposing horizontal arrows (custody "transfer" affordance) — each
 * shaft + chevron head laid out directly on the 24×24 grid, not a
 * memorized glyph. */
export const TransferIcon = createIcon(["M3 7h15", "M14 3l4 4-4 4", "M21 17H6", "M10 21l-4-4 4-4"]);

/** Circle + handle, built from primitives rather than a memorized lucide path. */
export function SearchIcon({ size = 16, strokeWidth = 2, ...props }: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.4" y2="16.4" />
    </svg>
  );
}

export const MegaphoneIcon = createIcon([
  "M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  "M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14",
  "M8 6v8",
]);

export const TicketIcon = createIcon([
  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
  "M13 5v2",
  "M13 17v2",
  "M13 11v2",
]);

export const WrenchIcon = createIcon([
  "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
]);

/** Built from primitives (circle + 8 radial lines at 45° increments), not
 * a memorized icon path — geometry computed directly, so correctness
 * doesn't depend on recalling exact upstream coordinates. */
export function SunIcon({ size = 16, strokeWidth = 2, ...props }: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12.00" y1="5.00" x2="12.00" y2="1.50" />
      <line x1="16.95" y1="7.05" x2="19.42" y2="4.58" />
      <line x1="19.00" y1="12.00" x2="22.50" y2="12.00" />
      <line x1="16.95" y1="16.95" x2="19.42" y2="19.42" />
      <line x1="12.00" y1="19.00" x2="12.00" y2="22.50" />
      <line x1="7.05" y1="16.95" x2="4.58" y2="19.42" />
      <line x1="5.00" y1="12.00" x2="1.50" y2="12.00" />
      <line x1="7.05" y1="7.05" x2="4.58" y2="4.58" />
    </svg>
  );
}

/** A true crescent — one circle masked by a second, offset circle — rather
 * than a memorized crescent path, so the geometry is self-evidently
 * correct instead of trusting recalled coordinates. */
export function MoonIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  const maskId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <mask id={maskId}>
        <rect width="24" height="24" fill="white" />
        <circle cx="15.5" cy="8.5" r="6.5" fill="black" />
      </mask>
      <circle cx="11" cy="13" r="8" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

/** Three QR "finder pattern" corners (outer ring + inner dot, the real
 * marks that make a QR code recognizable) plus a couple of loose data
 * squares in the open fourth corner — laid out on a plain grid, not a
 * memorized glyph. */
export function QrCodeIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {finder(1.5, 1.5)}
      {finder(15.5, 1.5)}
      {finder(1.5, 15.5)}
      <rect x="15.5" y="15.5" width="3" height="3" fill="currentColor" />
      <rect x="19.5" y="15.5" width="3" height="3" fill="currentColor" />
      <rect x="15.5" y="19.5" width="3" height="3" fill="currentColor" />
    </svg>
  );
}

/** A flat-top shield (two straight sides tapering to a bottom point) plus a
 * 3-point checkmark — plain coordinates, not a memorized glyph. */
export function ShieldCheckIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 4h14v6.5c0 6-4 9.5-7 10.5-3-1-7-4.5-7-10.5V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A printer built from stacked primitives — top paper feed, body, output
 * tray, and a status dot — not a memorized glyph. */
export function PrintIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="6" y="2.5" width="12" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6" y="14.5" width="12" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="11.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Three equal horizontal bars — the hamburger menu affordance. */
export const MenuIcon = createIcon(["M4 6h16", "M4 12h16", "M4 18h16"]);

/** Three unequal-length rows (reads as text lines, unlike MenuIcon's three
 * equal bars, which reads as a hamburger) — the "list view" affordance. */
export const ListIcon = createIcon(["M4 6h16", "M4 12h10", "M4 18h13"]);

/** A 2×2 grid of rounded squares (the classic "dashboard" mark) — four
 * rects laid out on the 24×24 grid, not a memorized glyph. */
export function DashboardIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  const tile = (x: number, y: number) => (
    <rect key={`${x}-${y}`} x={x} y={y} width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {tile(3.25, 3.25)}
      {tile(13.25, 3.25)}
      {tile(3.25, 13.25)}
      {tile(13.25, 13.25)}
    </svg>
  );
}

/** An office block built from primitives — outer shell, a centered door,
 * and a grid of window squares — not a memorized glyph. */
export function BuildingIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  const win = (x: number, y: number) => <rect key={`${x}-${y}`} x={x} y={y} width="2.4" height="2.4" fill="currentColor" />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="4.5" y="2.5" width="15" height="19" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 21.5v-4a2 2 0 0 1 4 0v4" stroke="currentColor" strokeWidth="1.6" />
      {win(8, 6)}
      {win(13.6, 6)}
      {win(8, 11)}
      {win(13.6, 11)}
    </svg>
  );
}

/** Two people — each a head circle plus a shoulders arc (a half-capsule
 * stated as an arc command), the rear one offset and clipped by drawing
 * order — geometric primitives, not a memorized glyph. */
export function UsersIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M2.5 20.5v-1a6.5 6.5 0 0 1 13 0v1" />
      <path d="M16 4.4a3.5 3.5 0 0 1 0 6.2" />
      <path d="M18.6 13.6a6.5 6.5 0 0 1 2.9 5.4v1.5" />
    </svg>
  );
}

/** An ID card — landscape rect, a portrait circle on the left, and two
 * text lines on the right — plain primitives, not a memorized glyph. */
export function IdCardIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.8 15.8a2.8 2.8 0 0 1 5.4 0" />
      <path d="M14.5 9.5H19" />
      <path d="M14.5 13H19" />
    </svg>
  );
}

/** An inbox tray — rounded box with the classic front tray polyline cut
 * across it — plain coordinates, not a memorized glyph. */
export function InboxIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 13.5h4.8l1.7 2.8h5l1.7-2.8H21" />
    </svg>
  );
}

/** A warning triangle — equilateral-ish outline plus exclamation stem and
 * dot — plain coordinates, not a memorized glyph. */
export function AlertTriangleIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5 22 20H2Z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

/** A door frame (three-sided bracket) with an arrow leaving through it —
 * built from a path + shaft + chevron head, not a memorized glyph. */
export const LogOutIcon = createIcon(["M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4", "M20 12H9", "M16 8l4 4-4 4"]);

/** A single checkmark stroke — plain coordinates, not a memorized glyph. */
export const CheckIcon = createIcon(["M4 12.5l5 5L20 6.5"]);

/** A clock face — circle plus hour/minute hands at a fixed "ten past"
 * angle, not a memorized glyph. */
export function ClockIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l4 2.3" />
    </svg>
  );
}

/** An envelope — outer rect plus the folded-flap V, not a memorized glyph. */
export const MailIcon = createIcon(["M3 5h18v14H3z", "m3 6.5 9 6.5 9-6.5"]);
