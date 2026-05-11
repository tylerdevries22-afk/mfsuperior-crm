import Link from "next/link";
import {
  Activity,
  HeartPulse,
  Inbox,
  ListChecks,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Server-rendered tab bar for /admin. Each tab is a plain Link with
 * its own `?tab=<id>` href so URLs stay deep-linkable / shareable and
 * we don't need any client JS to switch tabs. The active tab gets a
 * lime underline accent matching the sidebar's active-state pattern
 * from PR #38.
 *
 * Order is deliberate: most-used (Tick) on the left, least-used
 * (Health) on the right.
 */

export type AdminTabId =
  | "tick"
  | "operations"
  | "imports"
  | "suppression"
  | "health";

export const ADMIN_TABS: ReadonlyArray<{
  id: AdminTabId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "tick", label: "Engine", icon: Activity },
  { id: "operations", label: "Operations", icon: ListChecks },
  { id: "imports", label: "Imports", icon: Inbox },
  { id: "suppression", label: "Suppression", icon: ShieldOff },
  { id: "health", label: "Health", icon: HeartPulse },
];

export const DEFAULT_ADMIN_TAB: AdminTabId = "tick";

export function normalizeAdminTab(raw: string | undefined): AdminTabId {
  return ADMIN_TABS.some((t) => t.id === raw)
    ? (raw as AdminTabId)
    : DEFAULT_ADMIN_TAB;
}

export function AdminTabNav({ active }: { active: AdminTabId }) {
  return (
    <nav
      aria-label="Admin sections"
      className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      {ADMIN_TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={`/admin?tab=${id}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground/80",
              )}
              aria-hidden
            />
            {label}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
