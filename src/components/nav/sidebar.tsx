"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Mail,
  Shield,
  Settings,
  Bell,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/sequences", label: "Sequences", icon: GitBranch },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * App shell sidebar.
 *
 *   • Desktop (≥md): full 240px sidebar with logo, labels, and footer.
 *   • Mobile  (<md): persistent 56px left rail with icon-only nav.
 *
 * The mobile rail is ALWAYS visible — replaces the previous
 * top-bar + slide-out drawer pattern. Operators on phones reported
 * the hamburger added a click they shouldn't need; a thin icon rail
 * gives one-tap access to every section without sacrificing much
 * horizontal real estate.
 *
 * Layout requirements (handled in `(app)/layout.tsx`):
 *   • Root container is `flex flex-row` at every breakpoint so the
 *     rail / sidebar sits flush-left.
 */
export function Sidebar({ unreadNotifications = 0 }: { unreadNotifications?: number }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile rail — only on <md. 56px (w-14) wide, icon-only,
          always visible. */}
      <aside
        aria-label="Main navigation"
        className="flex h-screen w-14 shrink-0 flex-col items-center border-r border-border bg-card md:hidden"
      >
        <Link
          href="/dashboard"
          aria-label="Dashboard — MF Superior"
          className="flex h-14 w-full items-center justify-center border-b border-border transition-opacity hover:opacity-80"
        >
          <div className="logo-neon-glow relative size-8 overflow-hidden rounded-md">
            <Image
              src="/logo.png"
              alt="MF Superior Products"
              fill
              sizes="32px"
              className="object-contain p-0.5"
              priority
            />
          </div>
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            const showBadge =
              href === "/notifications" && unreadNotifications > 0;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {/* Active-item stripe on the left edge. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-r-sm bg-primary"
                  />
                )}
                <Icon
                  className={cn(
                    "size-5",
                    active ? "text-primary" : "",
                  )}
                  aria-hidden
                />
                {showBadge && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold tabular-nums text-primary-foreground"
                  >
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop sidebar — only on ≥md. Unchanged from prior layout. */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <SidebarBrand />
        <SidebarNav pathname={pathname} unreadNotifications={unreadNotifications} />
        <SidebarFooter />
      </aside>
    </>
  );
}

/* ─── Desktop sub-pieces ──────────────────────────────────────────── */

function SidebarBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 border-b border-border px-5 py-4 transition-opacity hover:opacity-80"
      title="Go to MF Superior landing page"
    >
      <div className="logo-neon-glow relative size-9 shrink-0 overflow-hidden rounded-md">
        <Image
          src="/logo.png"
          alt="MF Superior Products"
          fill
          sizes="36px"
          className="object-contain p-1"
          priority
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">
          MF Superior
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Freight Box Trucks
        </p>
      </div>
    </Link>
  );
}

function SidebarNav({
  pathname,
  unreadNotifications = 0,
}: {
  pathname: string;
  unreadNotifications?: number;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          const showBadge = href === "/notifications" && unreadNotifications > 0;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-primary"
                  />
                )}
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  aria-hidden
                />
                <span className="truncate flex-1">{label}</span>
                {showBadge && (
                  <span
                    className={cn(
                      "ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      "bg-primary text-primary-foreground",
                    )}
                  >
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border px-3 py-3 text-[11px] text-muted-foreground">
      <p className="flex items-center justify-between font-mono tabular-nums">
        <span>v0.1.0 · MVP</span>
        <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-px font-mono">
          ⌘K
        </kbd>
      </p>
    </div>
  );
}
