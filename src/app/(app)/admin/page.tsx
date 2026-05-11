import {
  AdminTabNav,
  ADMIN_TABS,
  normalizeAdminTab,
} from "./_tabs/tab-nav";
import { HealthTab } from "./_tabs/health";
import { ImportsTab } from "./_tabs/imports";
import { OperationsTab } from "./_tabs/operations";
import { SuppressionTab } from "./_tabs/suppression";
import { TickTab } from "./_tabs/tick";
import type { AdminSearch } from "./_tabs/types";

export const metadata = { title: "Admin" };

// Lead-research server actions (manual tick, manual poll, sync,
// generate leads, Denver batch 1) can each run for tens of seconds.
// `maxDuration = 60` keeps Vercel Pro from killing them at the
// default 10s timeout. Lifted from the pre-split monolith — every
// action is still invoked from inside this page tree.
export const maxDuration = 60;

/**
 * /admin — tabbed control panel. Pre-PR this was a single 1000-line
 * component that pre-fetched data for every section on every visit.
 * Now each tab is its own component that fetches just the data it
 * needs, and the tab nav is a server-rendered Link list keyed off
 * the `?tab=<id>` URL param — no client JS required.
 *
 * Default tab when no param is present: `tick` (the engine, since
 * that's the most-used surface for daily ops).
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearch>;
}) {
  const sp = await searchParams;
  const active = normalizeAdminTab(sp.tab);
  const tabMeta = ADMIN_TABS.find((t) => t.id === active);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tabMeta
            ? // Per-tab subtitle keeps the operator anchored without
              // adding chrome — copy lifted from the original page.
              {
                tick: "Manual tick, inbox poll, and Drive sync controls.",
                operations:
                  "Bulk operations on leads — archive, restore, validate, fix.",
                imports:
                  "Bring new candidates into the CRM via curated batches or live discovery.",
                suppression:
                  "Email addresses the engine must never contact again.",
                health: "Connection status, orphans, and the recent audit log.",
              }[active]
            : "Tick, audit log, suppression list, health."}
        </p>
      </header>

      <AdminTabNav active={active} />

      {/* Each tab renders independently. Async tabs (health,
          suppression) do their own DB fetches inline — non-active
          tabs aren't rendered, so unused queries don't fire. */}
      {active === "tick" && <TickTab sp={sp} />}
      {active === "operations" && <OperationsTab sp={sp} />}
      {active === "imports" && <ImportsTab sp={sp} />}
      {active === "suppression" && <SuppressionTab />}
      {active === "health" && <HealthTab sp={sp} />}
    </div>
  );
}
