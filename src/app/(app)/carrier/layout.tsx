import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Carrier workspace shell. The sub-pages (loads, dispatch, drivers, EDI)
 * previously had no navigation between them — the sidebar only links to
 * `/carrier`, so everything below it was URL-only. This bar makes the section
 * navigable, including the dispatch board added alongside it.
 *
 * Server-rendered plain links: no client JS, and the active state is left to
 * the browser's own `:focus`/hover affordances plus the page heading, matching
 * how `/admin` renders its tabs.
 */
const CARRIER_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/carrier", label: "Overview" },
  { href: "/carrier/shipments", label: "Loads" },
  { href: "/carrier/dispatch", label: "Dispatch" },
  { href: "/carrier/drivers", label: "Drivers" },
  { href: "/carrier/edi", label: "EDI" },
];

export default function CarrierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        aria-label="Carrier sections"
        className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950 px-6"
      >
        {CARRIER_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap px-3 py-2.5 text-[13px] font-medium text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
