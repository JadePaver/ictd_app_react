import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon, MegaphoneIcon, TicketIcon, WrenchIcon } from "../ui/icons";
import type { ActivityEvent } from "../../types/api";

const KIND_CONFIG: Record<
  ActivityEvent["kind"],
  { label: string; icon: typeof TicketIcon; color: string; path: string }
> = {
  technical_request: { label: "Technical request", icon: TicketIcon, color: "var(--series-1)", path: "/requests" },
  repair_item: { label: "Repair item", icon: WrenchIcon, color: "var(--series-6)", path: "/repairs" },
  announcement: { label: "Announcement", icon: MegaphoneIcon, color: "var(--series-5)", path: "/announcements" },
};

function dayBucket(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const event of events) {
      const key = dayBucket(event.createdAt);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [events]);

  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No recent activity.</p>;
  }

  return (
    <div className="flex flex-col">
      {groups.map(([label, groupEvents], groupIndex) => (
        <div key={label}>
          <p
            className={`px-1 pb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase ${
              groupIndex === 0 ? "" : "pt-4"
            }`}
          >
            {label}
          </p>
          <ul className="flex flex-col">
            {groupEvents.map((event) => {
              const config = KIND_CONFIG[event.kind];
              const Icon = config.icon;
              return (
                <li key={`${event.kind}-${event.id}`}>
                  <button
                    onClick={() => navigate(config.path)}
                    className="group flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${config.color} 14%, transparent)` }}
                    >
                      <Icon size={15} style={{ color: config.color }} strokeWidth={2} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{event.title}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {config.label}
                        {event.subtitle ? ` · ${event.subtitle}` : ""}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs tabular-nums text-ink-muted">{formatTime(event.createdAt)}</span>
                      <ChevronRightIcon
                        size={14}
                        className="text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
