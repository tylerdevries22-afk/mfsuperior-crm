"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Calendar,
  Mail,
  MapPin,
  Phone,
  X as XIcon,
} from "lucide-react";
import { StageChip, TagBadges, TierChip } from "@/components/leads/stage-chip";

/**
 * Slide-in lead-detail drawer — opens when an operator clicks a row
 * in /leads, slides in from the right, shows the most-needed
 * preview data, and offers a "Open full page →" link to the
 * existing /leads/[id] route when more detail is needed.
 *
 * Why a drawer instead of pure navigation:
 *   • Filter context (the rail) stays visible behind the overlay,
 *     so triaging 30 leads doesn't require 30 back-button presses.
 *   • Drawer fetches a deliberately slim payload (api/leads/[id]/
 *     summary) — typical render <100ms on a warm DB.
 *
 * Deep links still work: /leads/[id] is a full server-rendered
 * page. The drawer is layered on top of the table for in-context
 * triage, not as a replacement for the route.
 *
 * Closes via: backdrop click, Escape key, the X button, or the
 * Open-full-page link (which navigates away).
 */

type SummaryLead = {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  vertical: string | null;
  tier: "A" | "B" | "C" | null;
  stage: string;
  score: number | null;
  tags: string[];
  notes: string | null;
  notesTruncated: boolean;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
};

type SummaryEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  sequenceStep: number | null;
  templateName: string | null;
};

type SummaryEnrollment = {
  id: string;
  sequenceName: string;
  status: string;
  currentStep: number;
  nextSendAt: string | null;
};

type Summary = {
  lead: SummaryLead;
  events: SummaryEvent[];
  enrollments: SummaryEnrollment[];
};

export function LeadDrawer({
  leadId,
  onClose,
}: {
  leadId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refetch whenever the drawer is asked to display a different
  // lead. Reset stale data on close so a quick open-close-open
  // doesn't flash the previous lead.
  useEffect(() => {
    if (!leadId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/api/leads/${leadId}/summary`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Summary;
      })
      .then((d) => setData(d))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [leadId]);

  // Close on Escape from anywhere — matches Cmd-K palette ergonomics.
  useEffect(() => {
    if (!leadId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [leadId, onClose]);

  if (!leadId) return null;

  const lead = data?.lead ?? null;
  const fullName =
    lead && [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const headerName =
    lead?.companyName ?? (fullName || "(Untitled lead)");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lead detail"
      className="fixed inset-0 z-40 flex justify-end"
    >
      {/* Backdrop — clicking dismisses. Lower z-index than the
          panel so the click handler is on the backdrop layer. */}
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — fixed width on desktop, full width on mobile.
          `relative` lifts it above the backdrop. */}
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-hidden bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            {lead ? (
              <>
                <div className="flex items-center gap-2">
                  <TierChip tier={lead.tier} />
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {headerName}
                  </h2>
                </div>
                {fullName && lead.companyName && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {fullName}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <StageChip stage={lead.stage} />
                  {lead.score != null && (
                    <span className="rounded-full border border-border bg-secondary/40 px-1.5 py-0.5 font-mono tabular-nums">
                      Score {lead.score}
                    </span>
                  )}
                  {lead.vertical && <span>{lead.vertical}</span>}
                </div>
              </>
            ) : (
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {loading ? "Loading…" : error ? "Error" : "Lead"}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/leads/${leadId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary/40"
              title="Open the full lead detail page"
            >
              Full page <ArrowUpRight className="size-3" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              Failed to load: {error}.{" "}
              <Link
                href={`/leads/${leadId}`}
                onClick={onClose}
                className="underline"
              >
                Open the full page →
              </Link>
            </p>
          ) : data && lead ? (
            <div className="space-y-5">
              {/* Contact + location ───────────────────── */}
              <section>
                <SectionTitle>Contact</SectionTitle>
                <dl className="space-y-1.5 text-[13px]">
                  <Field
                    icon={<Mail className="size-3.5 text-muted-foreground" />}
                    label="Email"
                  >
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="font-mono text-[12px] text-foreground hover:text-primary"
                      >
                        {lead.email}
                      </a>
                    ) : (
                      <span className="italic text-muted-foreground">
                        none on file
                      </span>
                    )}
                  </Field>
                  {lead.phone && (
                    <Field
                      icon={
                        <Phone className="size-3.5 text-muted-foreground" />
                      }
                      label="Phone"
                    >
                      <span className="font-mono text-[12px] text-foreground">
                        {lead.phone}
                      </span>
                    </Field>
                  )}
                  {lead.website && (
                    <Field
                      icon={
                        <Building2 className="size-3.5 text-muted-foreground" />
                      }
                      label="Website"
                    >
                      <a
                        href={
                          lead.website.startsWith("http")
                            ? lead.website
                            : `https://${lead.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-foreground hover:text-primary"
                      >
                        {lead.website}
                      </a>
                    </Field>
                  )}
                  {(lead.city || lead.state) && (
                    <Field
                      icon={
                        <MapPin className="size-3.5 text-muted-foreground" />
                      }
                      label="Location"
                    >
                      <span className="text-foreground">
                        {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </span>
                    </Field>
                  )}
                  {lead.lastContactedAt && (
                    <Field
                      icon={
                        <Calendar className="size-3.5 text-muted-foreground" />
                      }
                      label="Last contacted"
                    >
                      <span className="font-mono text-[12px] tabular-nums text-foreground">
                        {new Date(lead.lastContactedAt)
                          .toISOString()
                          .slice(0, 10)}
                      </span>
                    </Field>
                  )}
                </dl>
              </section>

              {/* Tags ────────────────────────────────── */}
              {lead.tags.length > 0 && (
                <section>
                  <SectionTitle>Tags</SectionTitle>
                  <TagBadges tags={lead.tags} max={20} />
                </section>
              )}

              {/* Active enrollments ──────────────────── */}
              {data.enrollments.length > 0 && (
                <section>
                  <SectionTitle>Enrollments</SectionTitle>
                  <ul className="space-y-1.5">
                    {data.enrollments.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-[12px]"
                      >
                        <span className="truncate font-medium text-foreground">
                          {e.sequenceName}
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="capitalize">{e.status}</span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="font-mono tabular-nums">
                            step {e.currentStep}
                          </span>
                          {e.nextSendAt && (
                            <>
                              <span className="text-muted-foreground/60">
                                ·
                              </span>
                              <span className="font-mono tabular-nums">
                                next{" "}
                                {new Date(e.nextSendAt)
                                  .toISOString()
                                  .slice(0, 10)}
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Recent activity ─────────────────────── */}
              {data.events.length > 0 && (
                <section>
                  <SectionTitle>Recent activity</SectionTitle>
                  <ol className="relative space-y-1 border-l border-border pl-3">
                    {data.events.map((ev) => (
                      <li key={ev.id} className="relative text-[12px]">
                        <span className="absolute -left-[7px] top-1.5 size-1.5 rounded-full bg-primary" />
                        <p className="text-foreground">
                          <span className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
                            {ev.eventType}
                          </span>
                          {ev.templateName && (
                            <>
                              {" "}
                              <span className="text-muted-foreground">
                                via {ev.templateName}
                              </span>
                            </>
                          )}
                          {ev.sequenceStep != null && (
                            <>
                              {" "}
                              <span className="text-muted-foreground/70">
                                · step {ev.sequenceStep}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {new Date(ev.occurredAt)
                            .toISOString()
                            .slice(0, 19)
                            .replace("T", " ")}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Notes preview ───────────────────────── */}
              {lead.notes && (
                <section>
                  <SectionTitle>Notes</SectionTitle>
                  <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
                    {lead.notes}
                    {lead.notesTruncated && (
                      <span className="text-muted-foreground"> …</span>
                    )}
                  </p>
                </section>
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border bg-secondary/20 px-5 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-card px-1 py-px font-mono text-[10px]">
              esc
            </kbd>{" "}
            to close
          </p>
          {lead && (
            <Link
              href={`/leads/${leadId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:text-primary"
            >
              Open full page <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </footer>
      </aside>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center" aria-hidden>
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{children}</dd>
    </div>
  );
}
