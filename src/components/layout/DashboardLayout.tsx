import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Avatar } from "../ui/Avatar";
import { ToastProvider } from "../ui/Toast";
import {
  BuildingIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  DashboardIcon,
  IdCardIcon,
  LogOutIcon,
  MegaphoneIcon,
  MenuIcon,
  QrCodeIcon,
  ReceiptIcon,
  TicketIcon,
  TransferIcon,
  UsersIcon,
  WrenchIcon,
  XIcon,
} from "../ui/icons";
import ictdSeal from "../../assets/ictd-seal.png";

type NavIcon = ComponentType<{ size?: number; className?: string }>;

const SIDEBAR_COLLAPSED_KEY = "ictd-dashboard-sidebar-collapsed";

function initialSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

/** Sidebar information architecture: the two read-only reporting screens
 * lead (Overview answers "how is the division doing?", Technician Report
 * answers "how is one person doing?"), then day-to-day operations, then the
 * inventory/custody cluster, then org directory data, grouped so the ten
 * destinations scan as four ideas instead of one long undifferentiated
 * list. */
const NAV_GROUPS: { heading: string | null; items: { to: string; label: string; icon: NavIcon; end?: boolean }[] }[] = [
  {
    heading: null,
    items: [
      { to: "/", label: "Overview", icon: DashboardIcon, end: true },
      { to: "/reports/technician", label: "Technician Report", icon: ChartBarIcon },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/requests", label: "Technical Requests", icon: TicketIcon },
      { to: "/repairs", label: "Repair Items", icon: WrenchIcon },
      { to: "/announcements", label: "Announcements", icon: MegaphoneIcon },
    ],
  },
  {
    heading: "Inventory",
    items: [
      { to: "/inventory", label: "Inventory", icon: QrCodeIcon, end: true },
      { to: "/inventory/pars", label: "PARs", icon: ReceiptIcon },
      { to: "/inventory/mr", label: "Memorandum Receipts", icon: TransferIcon },
      { to: "/inventory/custodians", label: "Custodians", icon: IdCardIcon },
    ],
  },
  {
    heading: "Directory",
    items: [
      { to: "/departments", label: "Departments", icon: BuildingIcon },
      { to: "/users", label: "Users", icon: UsersIcon },
    ],
  },
];

/** Flyout label for a rail item that's lost its inline text — anchored off
 * the trigger's own `relative` box and shown via `group-hover`, so no
 * portal/measurement is needed (the sidebar has no `overflow-hidden`
 * ancestor between the trigger and the viewport edge). Used for both nav
 * items and the sign-out button once the sidebar is collapsed. */
function RailTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute top-1/2 left-full z-20 ml-2 -translate-y-1/2 scale-95 rounded-md border border-[color:var(--border-hairline)] bg-surface px-2 py-1 text-xs font-medium whitespace-nowrap text-ink opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover:scale-100 group-hover:opacity-100">
      {label}
    </span>
  );
}

function NavGroups({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading ?? "root"} className="flex flex-col gap-1">
          {group.heading ? (
            collapsed ? (
              // Group headings carry no meaning once their text is gone —
              // a thin rule preserves the visual grouping without it.
              <div className="mx-2 my-1 h-px shrink-0 bg-[color:var(--gridline)]" />
            ) : (
              <p className="px-3 pt-1 text-[10px] font-semibold tracking-wider text-ink-muted uppercase">
                {group.heading}
              </p>
            )
          ) : null}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  "group relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                  isActive
                    ? // The 4px pill on the left edge marks "you are here" even
                      // for color-blind users the tint alone might not reach.
                      "bg-series-1/10 text-series-1 before:absolute before:top-1/2 before:left-0 before:h-4 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-series-1"
                    : "text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={16} className={clsx("shrink-0", isActive ? "text-series-1" : "text-ink-muted")} />
                  {collapsed ? (
                    <RailTooltip label={item.label} />
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function UserFooter({ collapsed, onSignOut }: { collapsed?: boolean; onSignOut: () => void }) {
  const { profile } = useAuth();
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email;

  return (
    <div className="shrink-0 border-t border-[color:var(--border-hairline)] pt-3">
      <div className={clsx("flex items-center", collapsed ? "justify-center" : "gap-2.5 px-2")}>
        <Avatar person={{ first_name: profile?.firstName, last_name: profile?.lastName }} size={collapsed ? 30 : 34} />
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
            <p className="truncate text-xs text-ink-muted">{profile?.email}</p>
          </div>
        )}
      </div>
      <button
        onClick={onSignOut}
        aria-label={collapsed ? "Sign out" : undefined}
        className={clsx(
          "group relative mt-2 flex items-center rounded-lg py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/[0.03] hover:text-ink dark:hover:bg-white/[0.06]",
          collapsed ? "w-full justify-center px-0" : "w-full gap-2.5 px-3",
        )}
      >
        <LogOutIcon size={15} className="shrink-0 text-ink-muted" />
        {collapsed ? <RailTooltip label="Sign out" /> : <span className="min-w-0 flex-1 truncate">Sign out</span>}
      </button>
    </div>
  );
}

/** The seal + product name + theme toggle. Collapsed drops to a centered
 * vertical stack (mark, then toggle) instead of trying to keep three things
 * abreast in a rail too narrow for them. */
function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={clsx("mb-6 flex shrink-0 items-center", collapsed ? "flex-col gap-2" : "gap-2.5 px-2")}>
      <img src={ictdSeal} alt="" className="h-9 w-9 shrink-0" />
      {collapsed ? null : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">ICTD App</p>
          <p className="truncate text-xs text-ink-muted">Admin Dashboard</p>
        </div>
      )}
      <ThemeToggle className="h-8 w-8 shrink-0" />
    </div>
  );
}

/** Circular handle straddling the sidebar's border, the universal affordance
 * for "this panel resizes" (VS Code, Notion, Linear all place it here). The
 * chevron itself never swaps icons — it just rotates 180°, so the same glyph
 * reads as "collapse" and "expand" depending on which way it's pointing. */
function CollapseHandle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="absolute top-16 -right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-hairline)] bg-surface text-ink-muted shadow-sm transition-colors hover:border-series-1/40 hover:text-series-1"
    >
      <ChevronLeftIcon size={13} className={clsx("transition-transform duration-300", collapsed && "rotate-180")} />
    </button>
  );
}

function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    drawerRef.current?.focus();
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div className={clsx("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={clsx("absolute inset-0 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        className={clsx(
          "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface p-4 shadow-2xl outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    // `data-app-shell`/`data-app-main` are the hooks index.css's print
    // block uses to unlock this viewport-locked shell for paper.
    <div data-app-shell className="flex h-screen overflow-hidden">
      <div className="no-print relative hidden shrink-0 md:block">
        <aside
          className={clsx(
            "flex h-full flex-col border-r border-[color:var(--border-hairline)] bg-surface p-4 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed ? "w-20" : "w-60",
          )}
        >
          <SidebarHeader collapsed={collapsed} />
          <NavGroups collapsed={collapsed} />
          <UserFooter collapsed={collapsed} onSignOut={() => signOut()} />
        </aside>
        <CollapseHandle collapsed={collapsed} onClick={toggleCollapsed} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="no-print flex shrink-0 items-center justify-between border-b border-[color:var(--border-hairline)] bg-surface px-3 py-3 md:hidden">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            >
              <MenuIcon size={19} />
            </button>
            <img src={ictdSeal} alt="" className="h-6 w-6 shrink-0" />
            <p className="text-sm font-semibold text-ink">ICTD App — Admin</p>
          </div>
          <ThemeToggle className="h-9 w-9" />
        </header>

        <main data-app-main className="flex-1 overflow-y-auto p-4 md:p-8">
          {/* Keyed by pathname so the entrance animation replays on route
              changes only — in-page state updates don't remount it. */}
          <ToastProvider className={collapsed ? "md:left-20" : "md:left-60"}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </ToastProvider>
        </main>
      </div>

      {/* Mobile nav drawer — the only navigation below `md`, where the
          sidebar is hidden. Always shows full labels regardless of the
          desktop rail's collapse state; a temporary overlay has no reason
          to economize on width the way a persistent rail does. */}
      <MobileDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <div className="mb-6 flex shrink-0 items-center gap-2.5 px-2">
          <img src={ictdSeal} alt="" className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">ICTD App</p>
            <p className="truncate text-xs text-ink-muted">Admin Dashboard</p>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          >
            <XIcon size={16} />
          </button>
        </div>
        <NavGroups onNavigate={() => setMobileNavOpen(false)} />
        <UserFooter onSignOut={() => signOut()} />
      </MobileDrawer>
    </div>
  );
}
