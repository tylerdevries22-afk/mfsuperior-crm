/**
 * Shape of every redirect param that any /admin server action can
 * push into the URL. Each tab reads the subset it cares about. The
 * full union lives here so adding a new action only requires
 * updating one place.
 *
 * Lifted verbatim from the pre-tab admin/page.tsx — every action's
 * redirect contract is preserved so the URL signatures the server
 * actions emit continue to render the right result panels.
 */
export type AdminSearch = {
  tab?: string;
  // ── Manual tick stats ────────────────────────────────────────
  due?: string;
  drafted?: string;
  sent?: string;
  completed?: string;
  paused?: string;
  failed?: string;
  suppressed?: string;
  no_email?: string;
  capped?: string;
  dur?: string;
  notes?: string;
  // ── Manual poll stats ────────────────────────────────────────
  poll?: string;
  threads?: string;
  replies?: string;
  bounces?: string;
  handled?: string;
  poll_errors?: string;
  poll_dur?: string;
  poll_notes?: string;
  // ── Drive sync stats ─────────────────────────────────────────
  sync?: string;
  sync_file?: string;
  sync_rows?: string;
  sync_inserted?: string;
  sync_confirmed?: string;
  sync_orphans?: string;
  sync_orphans_cleared?: string;
  sync_dur?: string;
  sync_notes?: string;
  // ── Business-name fix ─────────────────────────────────────────
  bizfix?: string;
  bizfix_updated?: string;
  bizfix_error?: string;
  // ── Validate-all-emails ──────────────────────────────────────
  validated?: string;
  v_checked?: string;
  v_valid?: string;
  v_invalid?: string;
  v_deleted?: string;
  v_dur?: string;
  validate_error?: string;
  // ── Email-trust pipeline re-validate ─────────────────────────
  trust_revalidated?: string;
  t_checked?: string;
  t_verified?: string;
  t_guessed?: string;
  t_unverified?: string;
  t_invalid?: string;
  t_archived?: string;
  t_hunter?: string;
  t_partial?: string;
  t_dur?: string;
  trust_error?: string;
  // ── Pending migrations applier ───────────────────────────────
  migrated?: string;
  m_applied?: string;
  migrate_error?: string;
  // ── Denver batch 1 ───────────────────────────────────────────
  batch1?: string;
  b1_validated?: string;
  b1_inserted?: string;
  b1_dup?: string;
  b1_invalid?: string;
  b1_enrolled?: string;
  b1_already?: string;
  b1_dur?: string;
  b1_sequence?: string;
  b1_error?: string;
};
