"use client";

import { useEffect, useState } from "react";
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
  Menu,
  X,
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
 * App shell: persistent sidebar on ≥md, slide-out drawer on <md.
 *
 * Behaviour the previous version was missing:
 *  - Drawer open/close state lives here (client component)
 *  - Body scroll is locked while the drawer is open
 *  - Escape closes the drawer
 *  - Route changes close the drawer (so a tap on a nav link feels right)
 *  - The trigger lives in a mobile-only top bar so the layout is symmetric
 *    with the desktop sidebar's brand strip
 */
export function Sidebar({ unreadNotifications = 0 }: { unreadNotifications?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Auto-close on route change so the drawer doesn't linger after nav.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape key closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar — only on <md */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="logo-neon-glow relative size-8 shrink-0 overflow-hidden rounded-md">
            <Image
              src="/logo.png"
              alt="MF Superior Products"
              fill
              sizes="32px"
              className="object-contain p-0.5"
              priority
            />
          </div>
          <span className="truncate text-sm font-semibold leading-tight text-foreground">
            MF Superior
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Desktop sidebar — only on ≥md */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <SidebarBrand />
        <SidebarNav pathname={pathname} unreadNotifications={unreadNotifications} />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer — fixed overlay, only on <md */}
      <div
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        {/* Backdrop */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Drawer panel */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
              onClick={() => setOpen(false)}
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
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav pathname={pathname} unreadNotifications={unreadNotifications} />
          <SidebarFooter />
        </div>
      </div>
    </>
  );
}

/* ─── Sub-pieces, shared between desktop sidebar and mobile drawer ─── */

function SidebarBrand() {
  return (
    <a
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
    </a>
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
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate flex-1">{label}</span>
                {showBadge && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
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
    <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <p className="font-mono tabular-nums">v0.1.0 · MVP</p>
    </div>
  );
}
