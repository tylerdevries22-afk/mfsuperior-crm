"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Auto-refresh control for the /inbox page.
 *
 * The inbox page itself is a server component that issues a fresh
 * Postgres SELECT on every render — so calling Next.js's
 * `router.refresh()` re-runs that query without a full navigation,
 * preserving filter state and scroll position. We do that
 * automatically on a 20-second interval and on a manual button click.
 *
 * Behavioral guarantees:
 *   • Pauses polling when the tab is hidden (visibilitychange) so
 *     a backgrounded inbox doesn't keep firing DB queries.
 *   • Surfaces a relative "last updated" timestamp so the operator
 *     can see at a glance how fresh the list is.
 *   • Spins the icon while a refresh is in-flight, so a manual
 *     click feels responsive even though the network round-trip
 *     finishes invisibly via RSC payloads.
 */
const POLL_INTERVAL_MS = 20_000;

export function InboxAutoRefresh() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  // Re-render every 5s so the "Xs ago" label stays current even when
  // the data underneath hasn't changed (otherwise the label freezes
  // until the next poll fires).
  const [, setTick] = useState(0);
  const inFlightRef = useRef(false);
  const visibleRef = useRef(true);

  // Run a single refresh — guarded against overlap so a slow round-
  // trip doesn't pile up if the interval ticks again before it
  // returns.
  const doRefresh = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    router.refresh();
    // router.refresh() doesn't return a promise; the RSC payload
    // arrives asynchronously and the component re-mounts via the
    // streaming response. 700ms is a comfortable visual minimum so
    // the spin animation is perceptible even when the query is fast.
    setTimeout(() => {
      inFlightRef.current = false;
      setRefreshing(false);
      setLastUpdated(new Date());
    }, 700);
  };

  // Auto-poll loop. Skips ticks while the tab is hidden.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (visibleRef.current) doRefresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause polling when the tab is hidden. Resume + refresh-once
  // when it becomes visible again so a returning operator sees
  // up-to-date data immediately.
  useEffect(() => {
    const onVis = () => {
      const wasHidden = !visibleRef.current;
      visibleRef.current = document.visibilityState === "visible";
      if (wasHidden && visibleRef.current) doRefresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "Xs ago" label fresh.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const ago = formatAgo(Date.now() - lastUpdated.getTime());

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={doRefresh}
        disabled={refreshing}
        title="Refresh inbox (auto-refreshes every 20 s)"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/40 disabled:cursor-wait disabled:opacity-70"
      >
        <RotateCw
          className={cn(
            "size-3.5 transition-transform",
            refreshing && "animate-spin",
          )}
          aria-hidden
        />
        Refresh
      </button>
      <span
        title={`Last refreshed at ${lastUpdated.toLocaleTimeString()}`}
        className="text-[11px] tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        Updated {ago}
      </span>
    </div>
  );
}

/** Compact "Xs ago" / "Xm ago" formatter — same vocabulary the rest
 *  of the CRM uses (lead-table activity column, audit log feed). */
function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1_000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
