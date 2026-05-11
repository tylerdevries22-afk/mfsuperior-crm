"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search as SearchIcon,
  Users,
  FileText,
  Workflow,
  Settings as SettingsIcon,
  Mail,
  Inbox as InboxIcon,
  Wrench,
  X as XIcon,
  ArrowRight,
} from "lucide-react";

/**
 * Global Cmd+K command palette — Linear / Attio / Notion style.
 *
 * Opens with ⌘K (Mac) / Ctrl+K (everyone else) from anywhere inside
 * (app). Lets the operator:
 *   • Free-text search across leads, templates, sequences (debounced
 *     against /api/search)
 *   • Jump to any top-level route (/leads, /inbox, /templates, …) with
 *     a single keystroke + Enter
 *   • Trigger common admin actions (validate emails, run tick, etc.)
 *
 * Why this matters: pre-palette, finding a lead from settings required
 * 3 clicks (sidebar → leads → search). Now it's ⌘K → type → Enter.
 * The single biggest navigation upgrade in this PR.
 */

type LeadHit = {
  id: string;
  companyName: string;
  email: string | null;
  city: string | null;
  stage: string;
};
type TemplateHit = { id: string; name: string; subject: string };
type SequenceHit = { id: string; name: string; status: string };

type SearchResults = {
  leads: LeadHit[];
  templates: TemplateHit[];
  sequences: SequenceHit[];
};

type StaticItem = {
  kind: "route" | "action";
  label: string;
  hint?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STATIC_ITEMS: StaticItem[] = [
  { kind: "route", label: "Leads", href: "/leads", icon: Users, hint: "Browse + filter" },
  { kind: "route", label: "Inbox", href: "/inbox", icon: InboxIcon, hint: "Replies + bounces" },
  { kind: "route", label: "Templates", href: "/templates", icon: FileText, hint: "Email templates" },
  { kind: "route", label: "Sequences", href: "/sequences", icon: Workflow, hint: "Outbound flows" },
  { kind: "route", label: "Admin", href: "/admin", icon: Wrench, hint: "Tick, suppression, health" },
  { kind: "route", label: "Settings", href: "/settings", icon: SettingsIcon },
  { kind: "route", label: "New lead", href: "/leads/new", icon: Mail, hint: "Quick add" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({
    leads: [],
    templates: [],
    sequences: [],
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open via ⌘K / Ctrl+K from anywhere. Close via Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus input on open + reset state.
  useEffect(() => {
    if (open) {
      setQ("");
      setResults({ leads: [], templates: [], sequences: [] });
      setActiveIdx(0);
      // Wait for the modal to mount before focusing.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search. Skip the API for queries < 2 chars to avoid
  // pointless round-trips.
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults({ leads: [], templates: [], sequences: [] });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as SearchResults;
        setResults(data);
        setActiveIdx(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Surface in console for diagnosis; UI stays silent.
          console.error("[CommandPalette] search failed", err);
        }
      }
    }, 120);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  // Flatten everything into a single list for keyboard nav.
  type FlatItem =
    | { kind: "static"; item: StaticItem }
    | { kind: "lead"; lead: LeadHit }
    | { kind: "template"; tpl: TemplateHit }
    | { kind: "sequence"; seq: SequenceHit };

  const flat: FlatItem[] = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list: FlatItem[] = [];
    // Static routes filter to those whose label includes the query.
    for (const s of STATIC_ITEMS) {
      if (!ql || s.label.toLowerCase().includes(ql)) {
        list.push({ kind: "static", item: s });
      }
    }
    for (const lead of results.leads) list.push({ kind: "lead", lead });
    for (const tpl of results.templates) list.push({ kind: "template", tpl });
    for (const seq of results.sequences) list.push({ kind: "sequence", seq });
    return list;
  }, [q, results]);

  const onSelect = useCallback(
    (item: FlatItem) => {
      let href: string | null = null;
      if (item.kind === "static") href = item.item.href ?? null;
      else if (item.kind === "lead") href = `/leads/${item.lead.id}`;
      else if (item.kind === "template") href = `/templates/${item.tpl.id}`;
      else if (item.kind === "sequence") href = `/sequences/${item.seq.id}`;
      if (href) {
        setOpen(false);
        router.push(href);
      }
    },
    [router],
  );

  // Keyboard nav inside the palette.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIdx];
      if (item) onSelect(item);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40"
      >
        <SearchIcon className="size-3.5" />
        <span>Search…</span>
        <kbd className="ml-2 rounded border border-border bg-secondary/50 px-1 py-px font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 backdrop-blur-sm p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, templates, sequences…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {q.trim().length < 2
                ? "Start typing to search…"
                : "No matches."}
            </p>
          ) : (
            <ul className="space-y-px">
              {flat.map((item, i) => {
                const active = i === activeIdx;
                let icon: React.ReactNode = null;
                let primary: string = "";
                let secondary: string = "";

                if (item.kind === "static") {
                  const Icon = item.item.icon;
                  icon = <Icon className="size-3.5 text-muted-foreground" />;
                  primary = item.item.label;
                  secondary = item.item.hint ?? "";
                } else if (item.kind === "lead") {
                  icon = <Users className="size-3.5 text-muted-foreground" />;
                  primary = item.lead.companyName;
                  secondary = [
                    item.lead.email,
                    item.lead.city,
                    `stage: ${item.lead.stage}`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                } else if (item.kind === "template") {
                  icon = (
                    <FileText className="size-3.5 text-muted-foreground" />
                  );
                  primary = item.tpl.name;
                  secondary = item.tpl.subject;
                } else if (item.kind === "sequence") {
                  icon = (
                    <Workflow className="size-3.5 text-muted-foreground" />
                  );
                  primary = item.seq.name;
                  secondary = item.seq.status;
                }

                return (
                  <li key={`${item.kind}-${i}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => onSelect(item)}
                      className={
                        "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors " +
                        (active
                          ? "bg-secondary/60 text-foreground"
                          : "text-foreground hover:bg-secondary/30")
                      }
                    >
                      {icon}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{primary}</span>
                        {secondary ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {secondary}
                          </span>
                        ) : null}
                      </span>
                      {active && (
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/20 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-card px-1">↑↓</kbd>{" "}
            navigate · <kbd className="rounded border border-border bg-card px-1">↵</kbd>{" "}
            open · <kbd className="rounded border border-border bg-card px-1">esc</kbd>{" "}
            close
          </span>
          <Link
            href="/leads/new"
            onClick={() => setOpen(false)}
            className="hover:text-foreground"
          >
            + Add lead
          </Link>
        </div>
      </div>
    </div>
  );
}
