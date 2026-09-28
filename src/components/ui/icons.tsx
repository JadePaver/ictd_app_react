import { useId, type SVGProps } from "react";

/**
 * Hand-picked Lucide icon paths (ISC license, https://lucide.dev), inlined
 * as plain components instead of importing from `lucide-react` — that
 * package's barrel export doesn't tree-shake under this project's bundler,
 * so a static `import { X } from "lucide-react"` pulls in its entire
 * ~4,000-icon set (a ~500KB gzip regression for 4 icons).
 *
 * Every icon here is decorative: it always sits beside real text, or inside
 * a control that carries its own `aria-label`. So they all default to
 * `aria-hidden` and out of the tab order, which keeps a screen reader from
 * announcing a stream of unlabelled graphics. An icon that ever needs to
 * carry meaning on its own can override both, since `{...props}` is spread
 * last: `<CheckIcon aria-hidden={false} role="img" aria-label="Passed" />`.
 */
type IconProps = SVGProps<SVGSVGElement>;

function createIcon(paths: string[]) {
  return function Icon({ size = 16, strokeWidth = 2, ...props }: IconProps & { size?: number }) {
    return (
      <svg aria-hidden="true" focusable="false"
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
    <svg aria-hidden="true" focusable="false"
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
    <svg aria-hidden="true" focusable="false"
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 13.5h4.8l1.7 2.8h5l1.7-2.8H21" />
    </svg>
  );
}

/** A warning triangle — equilateral-ish outline plus exclamation stem and
 * dot — plain coordinates, not a memorized glyph. */
export function AlertTriangleIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
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
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l4 2.3" />
    </svg>
  );
}

/** An envelope — outer rect plus the folded-flap V, not a memorized glyph. */
export const MailIcon = createIcon(["M3 5h18v14H3z", "m3 6.5 9 6.5 9-6.5"]);

/** An L-shaped axis with three columns of increasing height: the
 * "report / performance" mark. Bars are plain rects on the 24×24 grid, not
 * a memorized glyph. */
export function ChartBarIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 3v16.5a1.5 1.5 0 0 0 1.5 1.5H21" />
      <rect x="7.5" y="12.5" width="3.2" height="5" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="12.9" y="9" width="3.2" height="8.5" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="18.3" y="5.5" width="3.2" height="12" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A sheet of paper with a folded corner and two text lines: the
 * "printable document" mark, built from primitives. */
export function FileTextIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
      <path d="M14 2.5V8h5.5" />
      <path d="M8.5 13h7" />
      <path d="M8.5 17h5" />
    </svg>
  );
}

/** A downward arrow into an open tray: the "download / export" affordance. */
export const DownloadIcon = createIcon(["M12 3.5v11", "m7.5 10 4.5 4.5 4.5-4.5", "M4 19.5h16"]);

/** A rosette: a medal circle with two ribbon tails, the "rank / standing"
 * mark, drawn from primitives rather than a memorized glyph. */
export function AwardIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M8.6 13.2 7 21.5l5-2.8 5 2.8-1.6-8.3" />
    </svg>
  );
}

/** An upward trend arrow, the delta affordance; `TrendDownIcon` mirrors it. */
export const TrendUpIcon = createIcon(["M3.5 17.5 10 11l4 4 6.5-6.5", "M15.5 8.5H20.5V13.5"]);
export const TrendDownIcon = createIcon(["M3.5 8.5 10 15l4-4 6.5 6.5", "M15.5 17.5H20.5V12.5"]);

// --- Request-type marks. The report maps a `request_types.label` onto one of
// these by keyword, falling back to LifebuoyIcon for a type nobody has
// taught it about yet, so adding a row to `request_types` never breaks the
// sheet.

/** A desktop monitor on a stand: the "hardware" mark. */
export function MonitorIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M9 20.5h6" />
      <path d="M12 16.5v4" />
    </svg>
  );
}

/** An application window with a title bar: the "software" mark. */
export function AppWindowIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M2.5 9h19" />
      <circle cx="6" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Three broadcast arcs over a dot: the "network" mark. */
export function WifiIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
      <path d="M2.5 8.5a14 14 0 0 1 19 0" />
      <path d="M5.8 12.2a9.2 9.2 0 0 1 12.4 0" />
      <path d="M9 15.8a4.4 4.4 0 0 1 6 0" />
      <circle cx="12" cy="19.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A key: bit-ring plus shaft and teeth, the "account / access" mark. */
export function KeyIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="7.5" cy="8" r="4.5" />
      <path d="M10.7 11.3 20 20.5" />
      <path d="m16.5 17 2-2" />
      <path d="m19 19.5 2-2" />
    </svg>
  );
}

/** A ring buoy: the neutral fallback for an unrecognized request type. */
export function LifebuoyIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="m5.6 5.6 3.8 3.8" />
      <path d="m14.6 14.6 3.8 3.8" />
      <path d="m18.4 5.6-3.8 3.8" />
      <path d="m9.4 14.6-3.8 3.8" />
    </svg>
  );
}

// --- Outcome marks. Each pairs with a text label everywhere it appears, so
// the icon reinforces the state rather than being the only carrier of it.

/** Circle plus checkmark: a completed task. */
export function CheckCircleIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.7 2.7L16 9.7" />
    </svg>
  );
}

/** Circle plus cross: a denied request. */
export function XCircleIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  );
}

/** Circle plus forward chevron: work accepted and under way. */
export function PlayCircleIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10.5 8.8 4.6 3.2-4.6 3.2z" />
    </svg>
  );
}

/** A stopwatch: crown, body, and a hand at the quarter, for elapsed-time figures. */
export function TimerIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M9.5 2.5h5" />
      <path d="M12 2.5v3.5" />
      <path d="M12 9.8v3.7h3" />
    </svg>
  );
}

/** A wall calendar: the "days worked" mark. */
export function CalendarIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

// --- Inventory marks. Category and item-status icons for the custody module,
// drawn on the same 24x24 grid from plain primitives. Each one always sits
// next to its text label, so the icon helps scanning but never carries the
// meaning alone.

/** A laptop: open screen over a keyboard deck. The "computer" category. */
export const LaptopIcon = createIcon([
  "M4 15V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v9",
  "M2 18.5h20",
  "M2 18.5 4 15h16l2 3.5",
]);

/** A keyboard: rounded deck, a row of key dots, and a space bar. */
export const KeyboardIcon = createIcon([
  "M3.5 6.5h17a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 16V8a1.5 1.5 0 0 1 1.5-1.5z",
  "M6 10h.01",
  "M10 10h.01",
  "M14 10h.01",
  "M18 10h.01",
  "M7.5 14h9",
]);

/** A mouse: a capsule with the button split. */
export const MouseIcon = createIcon(["M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6z", "M12 7v4"]);

/** A RAM stick: board, three chips, and edge pins. */
export const MemoryIcon = createIcon([
  "M3 7h18v8H3z",
  "M6.5 9.5h2v3h-2z",
  "M11 9.5h2v3h-2z",
  "M15.5 9.5h2v3h-2z",
  "M5.5 15v3",
  "M9.5 15v3",
  "M14.5 15v3",
  "M18.5 15v3",
]);

/** A drive: a sloped-top enclosure with a status light. The "storage" category. */
export const HardDriveIcon = createIcon([
  "M5.5 5h13l2.5 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-4.5z",
  "M3 13.5h18",
  "M7 16.5h.01",
  "M10 16.5h.01",
]);

/** A router: a flat box with two antennas and port lights. */
export const RouterIcon = createIcon([
  "M3.5 13h17a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-3A1.5 1.5 0 0 1 3.5 13z",
  "M6.5 13 5 6.5",
  "M17.5 13 19 6.5",
  "M6 16h.01",
  "M9.5 16h.01",
  "M13.5 16h4",
]);

/** A plug on a cable. The "other peripheral" category. */
export const PlugIcon = createIcon(["M9 2.5v4", "M15 2.5v4", "M6.5 6.5h11v4a5.5 5.5 0 0 1-11 0z", "M12 16v5.5"]);

/** An isometric box. The "other" category. */
export const BoxIcon = createIcon(["M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9z", "M3.5 7.5 12 12l8.5-4.5", "M12 12v9"]);

/** A storeroom: pitched roof over a stocked bay. "In storage" / with ICTD. */
export const WarehouseIcon = createIcon(["M3 21V9l9-5.5L21 9v12", "M7 21v-8h10v8", "M7 17h10"]);

/** A person: head and shoulders. */
export const UserIcon = createIcon(["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 20.5a7.5 7.5 0 0 1 15 0"]);

/** A question in a circle. The "missing" status. */
export const HelpCircleIcon = createIcon([
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6",
  "M12 17h.01",
]);

/** A bar in a circle. The "decommissioned" status. */
export const MinusCircleIcon = createIcon(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M8 12h8"]);

/** An info mark in a circle. */
export const InfoIcon = createIcon(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 8h.01"]);

export const PlusIcon = createIcon(["M12 5v14", "M5 12h14"]);

export const ArrowRightIcon = createIcon(["M4 12h16", "m14 6 6 6-6 6"]);
export const ArrowLeftIcon = createIcon(["M20 12H4", "m10 6-6 6 6 6"]);

/** Two overlapping sheets: copy to clipboard. */
export const CopyIcon = createIcon([
  "M9.5 9h10A1.5 1.5 0 0 1 21 10.5v10a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 8 20.5v-10A1.5 1.5 0 0 1 9.5 9z",
  "M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-10A1.5 1.5 0 0 1 4.5 2h10A1.5 1.5 0 0 1 16 3.5V4",
]);

/** A trunk with one branch peeling off to the right: a split transfer. */
export const SplitIcon = createIcon(["M6 3v18", "M6 8.5a6 6 0 0 0 6 6h3.5", "m13 12 2.5 2.5L13 17"]);

/** An arrow curling back: return to ICTD. */
export const ReturnIcon = createIcon(["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"]);

export const PencilIcon = createIcon(["M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", "M14.5 5.5l4 4"]);

export const TrashIcon = createIcon([
  "M3 6h18",
  "M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6",
  "M5.5 6l1 13.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5L18.5 6",
  "M10 11v6",
  "M14 11v6",
]);

/** A mobile phone: the contact-number mark. */
export const PhoneIcon = createIcon([
  "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z",
  "M11 18.5h2",
]);

/** A luggage-style tag with its eyelet: the serial-number mark. */
export const TagIcon = createIcon(["M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z", "M7.5 7.5h.01"]);

/** A till receipt with a zigzag foot and printed lines: the PAR mark. */
export const ReceiptIcon = createIcon([
  "M5 2.5h14v19l-2.5-1.5-2.3 1.5-2.2-1.5-2.2 1.5-2.3-1.5L5 21.5z",
  "M8.5 7h7",
  "M8.5 10.5h7",
  "M8.5 14h4",
]);

/** A processor: a square die with pins on every side. The "cpu" category. */
export const CpuIcon = createIcon([
  "M6.5 6.5h11v11h-11z",
  "M9.5 9.5h5v5h-5z",
  "M9.5 3v3.5",
  "M14.5 3v3.5",
  "M9.5 17.5V21",
  "M14.5 17.5V21",
  "M3 9.5h3.5",
  "M3 14.5h3.5",
  "M17.5 9.5H21",
  "M17.5 14.5H21",
]);

/** A graphics card: a long board with a fan and the bracket edge. The "gpu" category. */
export const GpuIcon = createIcon([
  "M2 6.5h18.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H2",
  "M2 4v17",
  "M11 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "M17.5 10v4",
  "M5.5 17.5v2.5",
  "M9 17.5v2.5",
  "M12.5 17.5v2.5",
]);

/** A desktop tower with drive bay and power light: an assembled PC. */
export const TowerIcon = createIcon([
  "M7.5 2.5h9A1.5 1.5 0 0 1 18 4v16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4a1.5 1.5 0 0 1 1.5-1.5z",
  "M9 6.5h6",
  "M9 9.5h6",
  "M12 17.5h.01",
]);

/** Three stacked sheets: placement (loose, installed, holds parts). */
export const LayersIcon = createIcon(["M12 3 21.5 8 12 13 2.5 8z", "M2.5 12.5 12 17.5l9.5-5", "M2.5 16.5 12 21.5l9.5-5"]);

/** Three blocks and a fourth being added: put parts together into a PC. */
export const AssembleIcon = createIcon([
  "M4 4h6v6H4z",
  "M14 4h6v6h-6z",
  "M4 14h6v6H4z",
  "M17 14v6",
  "M14 17h6",
]);
