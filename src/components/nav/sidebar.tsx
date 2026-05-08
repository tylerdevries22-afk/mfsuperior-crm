"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Mail,
  Inbox,
  Shield,
  Settings,
  Menu,
  X,
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
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const currentLabel =
    NAV.find(
      (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
    )?.label ?? "MF Superior";

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="-ml-2 inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2"
          title="Go to MF Superior landing page"
        >
          <div className="relative size-7 shrink-0 overflow-hidden rounded-md">
            <Image
              src="/logo.png"
              alt="MF Superior Products"
              fill
              sizes="28px"
              className="object-contain p-0.5"
              priority
            />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">
            {currentLabel}
          </span>
        </Link>
        <span className="size-11" aria-hidden />
      </header>

      {/* Backdrop for mobile drawer */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[80vw] shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: always shown, narrower fixed width, no transform
          "md:static md:z-auto md:w-60 md:max-w-none md:translate-x-0 md:transition-none",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
            title="Go to MF Superior landing page"
          >
            <div className="relative size-9 shrink-0 overflow-hidden rounded-md">
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
            aria-label="Close menu"
            className="md:hidden -mr-1 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <p className="font-mono tabular-nums">v0.1.0 · MVP</p>
        </div>
      </aside>
    </>
  );
}
