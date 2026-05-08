"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "bottom" | "top";
type Align = "start" | "center" | "end";

export interface InfoTooltipProps {
  children: React.ReactNode;
  /** Accessible label for the trigger button. Defaults to "More info". */
  label?: string;
  /** Vertical placement relative to the trigger. */
  side?: Side;
  /** Horizontal alignment of the popover relative to the trigger. */
  align?: Align;
  /** Override the popover width (Tailwind class). Defaults to w-80 sm:w-96. */
  panelClassName?: string;
}

/**
 * Click-to-toggle info tooltip. Same behavior on desktop and touch:
 * tap/click the icon to open, click outside or press Escape to close.
 * Works without any animation library or portal.
 */
export function InfoTooltip({
  children,
  label = "More info",
  side = "bottom",
  align = "start",
  panelClassName,
}: InfoTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const sideClass =
    side === "top" ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]";
  const alignClass =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "end"
        ? "right-0"
        : "left-0";

  return (
    <span ref={wrapperRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Info className="size-3" aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-30 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-lg sm:w-96",
            sideClass,
            alignClass,
            panelClassName,
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
