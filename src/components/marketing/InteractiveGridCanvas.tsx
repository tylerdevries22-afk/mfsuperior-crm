'use client';

import { useEffect, useRef } from 'react';

/**
 * Light grid backdrop with an interactive yellow spotlight that
 * follows the cursor (desktop) or touch (mobile).
 *
 * Renders inside a parent `position: relative` container, fills it
 * absolutely, and stays behind every direct child via `z-index: 0`
 * (callers should set their own content's `position: relative` +
 * `z-index: 1` so the grid sits behind copy/cards).
 *
 * Two stacked layers:
 *
 *   1. Grid pattern — same dark-on-white pattern the white
 *      TypewriterSection uses, so the visual carries through.
 *   2. Spotlight — a yellow radial gradient pinned to cursor
 *      position via direct style writes (no React re-renders
 *      per pointer move). `mix-blend-mode: multiply` makes the
 *      yellow tint visible against the white background AND
 *      darken the grid lines underneath, which reads as
 *      "the grid is lit up yellow under your cursor."
 *
 * Performance: pointer-tracking is a single direct style write
 * per pointer event (debounced via rAF) — no canvas, no per-cell
 * DOM, no scaling cost. Spotlight also auto-fades a few seconds
 * after the last pointer activity, so an idle page doesn't have
 * a static yellow blob loitering on screen.
 *
 * Touch UX: on `touchstart` we instantly move the spotlight and
 * fade it in; on `touchmove` we follow; after `touchend` we keep
 * it visible for ~1 s then fade it out. So a tap visibly "lights
 * up" the grid for a moment, which is the requested effect.
 */

export function InteractiveGridCanvas({
  className,
  // Grid line spacing in px. Same as the TypewriterSection so the
  // pattern looks continuous across both.
  gridSize = 80,
  // Spotlight diameter in px. Roughly 3-4 grid cells wide.
  spotlightSize = 320,
  // Children render ABOVE the grid + spotlight. Callers can opt out
  // (e.g. when they're nesting their own content positioned over
  // the canvas) by passing nothing.
  children,
}: {
  className?: string;
  gridSize?: number;
  spotlightSize?: number;
  children?: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const pendingFrameRef = useRef<number | null>(null);
  const targetRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const spotlight = spotlightRef.current;
    const wrap = wrapRef.current;
    if (!spotlight || !wrap) return;

    const apply = () => {
      pendingFrameRef.current = null;
      const t = targetRef.current;
      // Positioning is fixed (viewport coords) so the spotlight
      // tracks the pointer 1:1 regardless of which child is
      // scrolled underneath it.
      spotlight.style.transform = `translate3d(${t.x - spotlightSize / 2}px, ${t.y - spotlightSize / 2}px, 0)`;
      spotlight.style.opacity = t.active ? '1' : '0';
    };

    const schedule = () => {
      if (pendingFrameRef.current != null) return;
      pendingFrameRef.current = requestAnimationFrame(apply);
    };

    const onPointerMove = (e: PointerEvent) => {
      targetRef.current.x = e.clientX;
      targetRef.current.y = e.clientY;
      targetRef.current.active = true;
      schedule();

      // Fade out after ~2 s of pointer idleness so an inactive
      // cursor doesn't leave a yellow halo on screen.
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => {
        targetRef.current.active = false;
        schedule();
      }, 2000);
    };

    const onPointerLeave = () => {
      targetRef.current.active = false;
      schedule();
    };

    // Touch handling: independently of pointer events, give touch
    // a longer "linger" window so the user sees the highlight
    // even after they lift their finger.
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      targetRef.current.x = t.clientX;
      targetRef.current.y = t.clientY;
      targetRef.current.active = true;
      schedule();
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      targetRef.current.x = t.clientX;
      targetRef.current.y = t.clientY;
      schedule();
    };
    const onTouchEnd = () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => {
        targetRef.current.active = false;
        schedule();
      }, 1200);
    };

    // Use pointer events for desktop + stylus + touch (touch falls
    // through pointer events as "pointerType=touch" on modern
    // browsers); add explicit touch handlers for the linger UX.
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      if (pendingFrameRef.current != null) cancelAnimationFrame(pendingFrameRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [spotlightSize]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: 'relative',
        // The canvas IS the white panel — Typewriter through
        // CtaSection live inside it, so the panel-over-hero
        // overlay behaviour (negative top margin + high z-
        // index + rounded top corners) is provided here at the
        // wrapper level. Removes the need for TypewriterSection
        // to own those properties, and gives the entire post-
        // hero region one continuous interactive surface.
        marginTop: '-100vh',
        zIndex: 10,
        borderTopLeftRadius: '40px',
        borderTopRightRadius: '40px',
        boxShadow: '0 -32px 60px -32px rgba(0, 0, 0, 0.7)',
        background: '#fff',
        // Faint dark lines, same spacing TypewriterSection used
        // before. Slightly darker than its original 0.045 so the
        // yellow multiply has more line-contrast to bite into.
        backgroundImage: `linear-gradient(rgba(17,17,17,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.06) 1px, transparent 1px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        // Pattern stays fixed in viewport while content scrolls,
        // so the spotlight tracks cursor coords cleanly and the
        // grid reads as a single document-wide texture.
        backgroundAttachment: 'fixed',
        overflow: 'hidden',
      }}
    >
      {/* Yellow spotlight. `position: fixed` so it tracks
          viewport coords directly; `pointer-events: none` so it
          never intercepts clicks; `mix-blend-mode: multiply`
          tints the white canvas yellow under the spotlight and
          darkens the grid lines underneath into a saturated
          yellow band. The transition smooths out the rAF
          throttle and the 2 s idle fade. */}
      <div
        ref={spotlightRef}
        aria-hidden
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: `${spotlightSize}px`,
          height: `${spotlightSize}px`,
          borderRadius: '50%',
          pointerEvents: 'none',
          background: `radial-gradient(circle, rgba(212, 224, 48, 0.55) 0%, rgba(212, 224, 48, 0.22) 35%, transparent 65%)`,
          mixBlendMode: 'multiply',
          opacity: 0,
          transition:
            'opacity 280ms ease, transform 60ms linear',
          willChange: 'transform, opacity',
          zIndex: 50,
        }}
      />
      {children}
    </div>
  );
}
