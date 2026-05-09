"use client";

import * as React from "react";
import Link from "next/link";
import { Send, Loader2, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { leads as leadsTable } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { StageChip, TagBadges, TierChip } from "@/components/leads/stage-chip";
import { Card, CardContent } from "@/components/ui/card";
import { bulkSendAction } from "@/app/(app)/leads/actions";

type Lead = typeof leadsTable.$inferSelect;
type Sequence = { id: string; name: string };

export function LeadsTable({
  rows,
  sequences,
}: {
  rows: Lead[];
  sequences: Sequence[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const allRowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected =
    allRowIds.length > 0 && allRowIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of allRowIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allRowIds) next.add(id);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  const selectedCount = selected.size;
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const noEmailCount = selectedRows.filter((r) => !r.email).length;
  const sendableCount = selectedCount - noEmailCount;

  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-hidden rounded-md border border-border">
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    ref={headerCheckboxRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={
                      allSelected ? "Deselect all on page" : "Select all on page"
                    }
                  />
                </th>
                <th className="px-3 py-2.5 text-right font-medium w-12">#</th>
                <th className="px-2 py-2.5 font-medium w-12">Tier</th>
                <th className="px-2 py-2.5 text-right font-medium w-16">Score</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Vertical</th>
                <th className="px-3 py-2.5 font-medium">City</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium">Last contacted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {rows.map((lead, i) => {
                const checked = selected.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className={
                      "group transition-colors " +
                      (checked
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-secondary/40")
                    }
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleOne(lead.id)}
                        aria-label={`Select ${lead.companyName ?? lead.email ?? "lead"}`}
                        title={
                          lead.email
                            ? undefined
                            : "No email on file — will be skipped on send"
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2.5">
                      <TierChip tier={lead.tier} />
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-sm tabular-nums text-foreground">
                      {lead.score ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {lead.companyName ?? "—"}
                      </Link>
                      {lead.email ? (
                        <p className="font-mono text-xs text-muted-foreground">
                          {lead.email}
                        </p>
                      ) : (
                        <p className="font-mono text-xs italic text-muted-foreground/60">
                          no email
                        </p>
                      )}
                      <TagBadges tags={lead.tags ?? []} className="mt-1" />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {lead.vertical ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {lead.city ?? "—"}
                      {lead.state ? `, ${lead.state}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <StageChip stage={lead.stage} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {lead.lastContactedAt
                        ? new Date(lead.lastContactedAt).toISOString().slice(0, 10)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <ul className="md:hidden space-y-2">
        {rows.map((lead) => {
          const checked = selected.has(lead.id);
          return (
            <li key={lead.id}>
              <div
                className={
                  "flex items-start gap-3 rounded-md border px-4 py-3 transition-colors " +
                  (checked
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/40")
                }
              >
                <Checkbox
                  checked={checked}
                  onChange={() => toggleOne(lead.id)}
                  aria-label={`Select ${lead.companyName ?? lead.email ?? "lead"}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="block truncate font-medium text-foreground"
                      >
                        {lead.companyName ?? "—"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.vertical ?? "—"}
                        {lead.city ? ` · ${lead.city}` : ""}
                      </p>
                      {lead.email ? (
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {lead.email}
                        </p>
                      ) : (
                        <p className="truncate font-mono text-xs italic text-muted-foreground/60">
                          no email
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TierChip tier={lead.tier} />
                      <span className="font-mono text-sm tabular-nums">
                        {lead.score ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StageChip stage={lead.stage} />
                    <TagBadges tags={lead.tags ?? []} max={2} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky action bar — wraps in a real <form action={...}> so Next
          handles redirect() from the server action correctly. */}
      {selectedCount > 0 && (
        <BulkActionForm
          count={selectedCount}
          sendableCount={sendableCount}
          noEmailCount={noEmailCount}
          sequences={sequences}
          selectedIds={[...selected]}
          onClear={clear}
          confirmOpen={confirmOpen}
          setConfirmOpen={setConfirmOpen}
        />
      )}
    </>
  );
}

/* ───── Reusable styled checkbox (visible borders in both themes) ─── */

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={
        "size-[18px] cursor-pointer rounded border-2 border-muted-foreground/40 bg-background accent-primary transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
        (className ?? "")
      }
      {...props}
    />
  );
});

/* ───── Bulk action form ──────────────────────────────────────────── */

function BulkActionForm({
  count,
  sendableCount,
  noEmailCount,
  sequences,
  selectedIds,
  onClear,
  confirmOpen,
  setConfirmOpen,
}: {
  count: number;
  sendableCount: number;
  noEmailCount: number;
  sequences: Sequence[];
  selectedIds: string[];
  onClear: () => void;
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
}) {
  const [sequenceId, setSequenceId] = React.useState(sequences[0]?.id ?? "");

  return (
    <form action={bulkSendAction}>
      {/* Hidden inputs — these are what bulkSendAction reads via FormData. */}
      <input type="hidden" name="sequenceId" value={sequenceId} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="leadIds" value={id} />
      ))}

      {/* Bottom sticky bar */}
      <div
        role="region"
        aria-label="Bulk actions"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-1px_8px_rgba(0,0,0,0.06)] backdrop-blur sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-foreground">
            <span className="font-mono tabular-nums">{count}</span> selected
            {noEmailCount > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">
                ({noEmailCount} will be skipped — no email)
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3" /> Clear
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">
              Sequence
              <select
                value={sequenceId}
                onChange={(e) => setSequenceId(e.target.value)}
                disabled={sequences.length === 0}
                className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sequences.length === 0 ? (
                  <option value="">No sequences</option>
                ) : (
                  sequences.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            {/* Open confirm modal — actual submit happens inside the modal */}
            <Button
              type="button"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={
                sendableCount === 0 || !sequenceId || sequences.length === 0
              }
            >
              <Send /> Send first email
              {sendableCount > 1 ? `s (${sendableCount})` : ""}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm modal — the submit button here actually fires the action */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-confirm-title"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-lg">
            <h2
              id="bulk-confirm-title"
              className="text-base font-semibold text-foreground"
            >
              Send first email to {sendableCount} lead
              {sendableCount === 1 ? "" : "s"}?
            </h2>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                Each selected lead will be enrolled in{" "}
                <span className="font-medium text-foreground">
                  {sequences.find((s) => s.id === sequenceId)?.name ?? "sequence"}
                </span>{" "}
                and the first template step will be sent right now (subject to
                your daily cap and warmup pacing).
              </p>
              <ul className="ml-4 list-disc space-y-0.5 text-xs">
                <li>Suppressed addresses are skipped.</li>
                <li>Already-enrolled leads are no-ops.</li>
                <li>
                  Open / click / reply / bounce tracking is wired automatically.
                </li>
                <li>
                  Each lead&apos;s stage advances{" "}
                  <span className="font-mono">new → contacted</span> on a
                  successful send.
                </li>
              </ul>
              {noEmailCount > 0 && (
                <p className="text-warning">
                  {noEmailCount} of your selection has no email and will be
                  skipped automatically.
                </p>
              )}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <CancelButton onCancel={() => setConfirmOpen(false)} />
              <SubmitButton disabled={!sequenceId} />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

/* ───── Submit button uses useFormStatus for pending state ─────────── */

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Sending…
        </>
      ) : (
        <>
          <Send /> Send now
        </>
      )}
    </Button>
  );
}

function CancelButton({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={onCancel}
      disabled={pending}
    >
      Cancel
    </Button>
  );
}
