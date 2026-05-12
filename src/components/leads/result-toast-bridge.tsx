"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Reads server-action redirect params from the URL and fires a single
 * sonner toast per param-set. Replaces the ~10 stacked banner cards
 * that used to live inline on /leads/page.tsx and made it impossible
 * to know which action just succeeded.
 *
 * Why a client bridge: server-action redirects stuff result counts
 * into the URL (?archived_bulk=1&archived=12). The page is server-
 * rendered, so we need a tiny client component to read those params
 * once on mount and surface a transient toast — the URL clears on
 * the next navigation, so this only fires for the operator who
 * triggered the action.
 *
 * Idempotency: a `ref` guard ensures each unique param set fires
 * exactly once per mount even under React strict-mode double-effects.
 */

type Search = Record<string, string | undefined>;

type Props = { sp: Search };

export function ResultToastBridge({ sp }: Props) {
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    // Build a stable key from the result-bearing params so the same
    // toast doesn't refire on hot reload.
    const key = JSON.stringify(sp);
    if (firedRef.current === key) return;
    firedRef.current = key;

    // ── Purge no-email leads ─────────────────────────────────────
    if (sp.purged === "1") {
      if (sp.purge_error) {
        toast.error(`Purge failed: ${decodeURIComponent(sp.purge_error)}`);
      } else {
        toast.success(
          `Archived ${sp.archived ?? 0} leads without an email address.`,
        );
      }
    }

    // ── Bulk archive selected ────────────────────────────────────
    if (sp.archived_bulk === "1") {
      if (sp.archive_error) {
        toast.error(
          `Archive failed: ${decodeURIComponent(sp.archive_error)}`,
        );
      } else {
        toast.success(`Archived ${sp.archived ?? 0} selected leads.`);
      }
    }

    // ── Generic archived (e.g., from row action) ──────────────────
    if (sp.archived === "1" && !sp.purged && !sp.archived_bulk) {
      toast.success("Lead archived.");
    }

    // ── Unarchive batch ──────────────────────────────────────────
    if (sp.unarchived === "1") {
      if (sp.unarchive_error) {
        toast.error(
          `Unarchive failed: ${decodeURIComponent(sp.unarchive_error)}`,
        );
      } else {
        const since =
          sp.unarchived_since && sp.unarchived_since !== "all"
            ? ` (window: ${sp.unarchived_since})`
            : "";
        toast.success(
          `Unarchived ${sp.unarchived_count ?? 0} leads${since}.`,
        );
      }
    }

    // ── Starter pack / verified quick-add (legacy) ───────────────
    if (sp.starter === "1") {
      if (sp.starter_error) {
        toast.error(
          `Quick-add failed: ${decodeURIComponent(sp.starter_error)}`,
        );
      } else {
        toast.success(
          `Quick-add: ${sp.just_added ?? 0} added · ${sp.just_updated ?? 0} updated · ${sp.just_enriched ?? 0} enriched · ${sp.just_skipped ?? 0} skipped.`,
        );
      }
    }

    // ── Verified Quick-add (backlog drain) ───────────────────────
    // New path: redirects with `verified=1` + counts of inserts,
    // verify-path breakdown, and a `v_backlog_warming` flag set
    // when the backlog was empty (so the click inserted 0 leads
    // and the refill is now running in the background).
    if (sp.verified === "1") {
      if (sp.verified_error) {
        toast.error(
          `Quick-add failed: ${decodeURIComponent(sp.verified_error)}`,
        );
      } else {
        const inserted = Number(sp.v_inserted ?? 0);
        const viaWebsite = Number(sp.v_website ?? 0);
        const viaHunter = Number(sp.v_hunter ?? 0);
        const warming = sp.v_backlog_warming === "1";

        if (inserted === 0 && warming) {
          // Cold start: empty backlog. The refill is running via
          // `after()` and will populate the queue in ~30s.
          toast.info("Warming up the lead backlog…", {
            description:
              "First click after deploy is empty. The verify pipeline is filling the backlog in the background — try Quick-add again in ~30 seconds for an instant batch.",
            duration: 10_000,
          });
        } else if (inserted === 0) {
          toast.warning("No new leads added.", {
            description:
              "The backlog drained empty and no fresh candidates passed verification. Wait for the next refill or check /admin → Health.",
          });
        } else {
          const parts = [
            `${inserted} added instantly`,
            viaWebsite > 0 ? `${viaWebsite} via website-scrape` : null,
            viaHunter > 0 ? `${viaHunter} via Hunter` : null,
          ].filter(Boolean) as string[];
          toast.success(parts.join(" · "), {
            description:
              "Backlog refilling in the background for the next click.",
          });
        }
      }
    }

    // ── Bulk send result (the noisiest banner pre-refactor) ──────
    if (sp.sent === "1") {
      const enrolled = Number(sp.enrolled ?? 0);
      const already = Number(sp.already_enrolled ?? 0);
      const tickSent = Number(sp.tick_sent ?? 0);
      const tickDrafted = Number(sp.tick_drafted ?? 0);
      const failed = Number(sp.tick_failed ?? 0);
      const capped = Number(sp.tick_capped ?? 0);
      const suppressed = Number(sp.suppressed ?? 0);

      const parts = [
        tickSent > 0 ? `${tickSent} sent` : null,
        tickDrafted > 0 ? `${tickDrafted} drafted` : null,
        enrolled > 0 ? `${enrolled} newly enrolled` : null,
        already > 0 ? `${already} already enrolled` : null,
        suppressed > 0 ? `${suppressed} suppressed` : null,
        capped > 0 ? `${capped} capped` : null,
        failed > 0 ? `${failed} failed` : null,
      ].filter(Boolean) as string[];

      const summary = parts.length > 0 ? parts.join(" · ") : "Send fired.";
      if (failed > 0) toast.warning(summary);
      else toast.success(summary);
    }

    // ── Imported leads from CSV (sp.imported is used by import page,
    //    but if a redirect lands on /leads with it we surface it too).
    if (sp.imported === "1") {
      toast.success(`Imported ${sp.imported_count ?? "leads"} from CSV.`);
    }
  }, [sp]);

  return null;
}
