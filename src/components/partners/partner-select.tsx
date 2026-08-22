"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PARTNERS, findPartner, sortPartners, type Partner } from "@/data/partners";
import { cn } from "@/lib/utils";
import { PartnerLogo } from "./partner-logo";

export interface PartnerSelectProps {
  value: string | null;
  onChange: (slug: string | null) => void;
  partners?: readonly Partner[];
  /** Label for the empty choice. Pass `null` to make a choice mandatory. */
  emptyLabel?: string | null;
  /** Restrict the list — the load pickers only offer partners we can bill. */
  filter?: (partner: Partner) => boolean;
  /** Emitted as a hidden input so the value posts with a server action. */
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Broker / customer picker that shows each partner's logo beside its name.
 *
 * A native `<select>` can't render an image inside `<option>`, so this is a
 * listbox: a button that owns the value plus a popover of options. Keyboard
 * handling mirrors the native control — Up/Down move, Enter and Space commit,
 * Escape closes, Home/End jump — and a hidden input keeps it usable inside a
 * plain `<form>` posting to a server action.
 */
export function PartnerSelect({
  value,
  onChange,
  partners = PARTNERS,
  emptyLabel = "No partner",
  filter,
  name,
  id,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: PartnerSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const options = useMemo(() => {
    const visible = sortPartners(filter ? partners.filter(filter) : [...partners]);
    const entries: Array<{ slug: string | null; label: string }> = visible.map(
      (partner) => ({ slug: partner.slug, label: partner.name }),
    );
    if (emptyLabel !== null) entries.unshift({ slug: null, label: emptyLabel });
    return entries;
  }, [partners, filter, emptyLabel]);

  const selected = findPartner(value, partners);
  const selectedLabel =
    selected?.name ?? (value ? value : (emptyLabel ?? "Select a partner"));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  /**
   * Open the popover with the highlight already on the current value, so the
   * first arrow press moves from where the user is rather than from the top.
   * Done here rather than in an effect keyed on `open` — that shape triggers a
   * second render pass on every open for no benefit.
   */
  function openList() {
    const index = options.findIndex((option) => option.slug === (value ?? null));
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.slug);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {value && <PartnerLogo slug={value} size="xs" partners={partners} />}
        <span
          className={cn(
            "flex-1 truncate text-left",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel ?? "Partners"}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute z-50 mt-1 max-h-72 w-full min-w-[240px] overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.slug === (value ?? null);
            return (
              <li
                key={option.slug ?? "__none"}
                role="option"
                data-index={index}
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  index === activeIndex
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {option.slug ? (
                  <PartnerLogo
                    slug={option.slug}
                    size="sm"
                    partners={partners}
                  />
                ) : (
                  <span className="inline-block size-5 shrink-0" aria-hidden />
                )}
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected && (
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
