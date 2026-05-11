"use client";

import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";
import { useMemo, useRef } from "react";

/**
 * Per-character cascade reveal — gray → lime flash → final color — driven
 * by SCROLL POSITION, not a one-shot trigger.
 *
 * Mirrors the technique used on terminal-industries.com (split-per-char
 * spans + per-letter delay) but binds each character's reveal progress
 * directly to the page scroll. As the headline scrolls up through the
 * viewport, letters animate from "rest → flash → final" left-to-right.
 *
 * Two modes (selected per-instance):
 *
 *   1. **scrollLinked = true (default)** — uses motion's `useScroll`
 *      against the wrapper's bounding box. Each character is a child
 *      component that calls `useTransform` on the shared scroll progress
 *      with its own narrow input range, so letters reveal at distinct
 *      scroll positions. This is the "scroll-driven" mode the user
 *      asked for.
 *
 *   2. **scrollLinked = false** — falls back to one-shot `whileInView`
 *      with stagger. Useful for above-the-fold copy where there's no
 *      scroll runway before the text is visible (rarely needed because
 *      mode 1 also handles that case via the offset window).
 */

type Props = {
  text: string;
  /** Per-character stagger / spread, expressed as a fraction of the
   *  scroll-window. Default 0.7 — the cascade occupies the first 70%
   *  of the section's scroll-window, leaving the last 30% as a "rest"
   *  state where the text is fully revealed. */
  spread?: number;
  /** Optional extra class on the wrapping <span>. */
  className?: string;
  /** Tag to render as. Default "span". */
  as?: "span" | "h1" | "h2" | "h3" | "p";
  /** Color the line settles to. Default "#fff" (good on dark BG). */
  finalColor?: string;
  /** Mid-flash color. Default brand lime "#D4E030". */
  flashColor?: string;
  /** Resting color before reveal. Default "rgba(255,255,255,0.18)". */
  restColor?: string;
  /** Scroll-linked mode (default true). Set false to use whileInView. */
  scrollLinked?: boolean;
  /** When scrollLinked, the offset passed to `useScroll`.
   *  Default ["start 85%", "start 30%"] — the cascade is fully complete
   *  by the time the headline reaches the upper third of the viewport. */
  offset?: [string, string];
  /** Optional shared scroll source. When supplied, the cascade is driven
   *  by this MotionValue instead of running its own `useScroll` against
   *  the wrapper. Use with `range` to give multiple cascades non-
   *  overlapping slices of a parent's scroll progress so they run
   *  sequentially (e.g. one per line of a stacked headline). */
  progress?: MotionValue<number>;
  /** Sub-range of the shared `progress` (0–1) within which this cascade
   *  plays. Defaults to [0, 1] — the full source range. */
  range?: [number, number];
  /** When NOT scrollLinked: per-character stagger in seconds. Default 0.03. */
  stagger?: number;
  /** When NOT scrollLinked: animation duration. Default 0.5. */
  duration?: number;
  /** When NOT scrollLinked: container delay. Default 0. */
  delay?: number;
};

export function CascadeText({
  text,
  spread = 0.7,
  className,
  as: Tag = "span",
  finalColor = "#fff",
  flashColor = "#D4E030",
  restColor = "rgba(255,255,255,0.18)",
  scrollLinked = true,
  offset = ["start 85%", "start 30%"],
  progress,
  range,
  stagger = 0.03,
  duration = 0.5,
  delay = 0,
}: Props) {
  const chars = useMemo(() => Array.from(text), [text]);
  const ref = useRef<HTMLElement>(null);

  // Shared-progress mode: parent supplies a MotionValue (e.g., from a
  // section-level useScroll) and a [start, end] sub-range. Each call
  // can claim a non-overlapping slice so multiple cascades within the
  // same scroll runway play sequentially, not in parallel.
  if (progress) {
    return (
      <SharedProgressCascade
        chars={chars}
        progress={progress}
        range={range ?? [0, 1]}
        spread={spread}
        Tag={Tag}
        className={className}
        text={text}
        finalColor={finalColor}
        flashColor={flashColor}
        restColor={restColor}
      />
    );
  }

  if (scrollLinked) {
    return (
      <ScrollLinkedCascade
        chars={chars}
        ref={ref}
        spread={spread}
        offset={offset}
        Tag={Tag}
        className={className}
        text={text}
        finalColor={finalColor}
        flashColor={flashColor}
        restColor={restColor}
      />
    );
  }

  return (
    <TriggerCascade
      chars={chars}
      Tag={Tag}
      className={className}
      text={text}
      finalColor={finalColor}
      flashColor={flashColor}
      restColor={restColor}
      stagger={stagger}
      duration={duration}
      delay={delay}
    />
  );
}

/* ─── Mode 1: scroll-linked (default) ─────────────────────────────── */

type ScrollProps = {
  chars: string[];
  ref: React.RefObject<HTMLElement | null>;
  spread: number;
  offset: [string, string];
  Tag: "span" | "h1" | "h2" | "h3" | "p";
  className?: string;
  text: string;
  finalColor: string;
  flashColor: string;
  restColor: string;
};

function ScrollLinkedCascade({
  chars,
  ref,
  spread,
  offset,
  Tag,
  className,
  text,
  finalColor,
  flashColor,
  restColor,
}: ScrollProps) {
  // useScroll's offset takes [start, end] strings like "start 85%" —
  // the wrapper's `start` edge crosses the viewport's `85%` line maps
  // to scrollYProgress=0; ["start 30%"] maps to scrollYProgress=1.
  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: offset as never,
  });

  const Container =
    Tag === "h1"
      ? "h1"
      : Tag === "h2"
        ? "h2"
        : Tag === "h3"
          ? "h3"
          : Tag === "p"
            ? "p"
            : "span";

  // Each char gets its own slice of [0, spread]. The remaining tail
  // (spread → 1) is the "fully revealed" rest period.
  const total = chars.length;

  // Tokenize into words + spaces so line breaks happen only AT spaces,
  // never in the middle of a word. Words become inline-block wrappers
  // (which cannot break internally); the chars inside the wrapper still
  // animate per-character because each ScrollChar is its own
  // inline-block <motion.span>.
  type Token =
    | { kind: "space"; ch: string; idx: number }
    | { kind: "word"; chars: string[]; startIdx: number };
  const tokens: Token[] = [];
  let cursor = 0;
  let buffer: string[] = [];
  let bufferStart = 0;
  const flushWord = () => {
    if (buffer.length > 0) {
      tokens.push({ kind: "word", chars: buffer, startIdx: bufferStart });
      buffer = [];
    }
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      flushWord();
      tokens.push({ kind: "space", ch, idx: cursor });
    } else {
      if (buffer.length === 0) bufferStart = cursor;
      buffer.push(ch);
    }
    cursor++;
  }
  flushWord();

  return (
    <Container
      ref={ref as never}
      // Removed display: inline-block so the headline can WRAP at spaces.
      // Inline-block on the parent would prevent any wrapping — words
      // would all stay on one line and overflow horizontally.
      aria-label={text}
      className={className}
    >
      {tokens.map((tok, ti) => {
        if (tok.kind === "space") {
          // Render space as a single ScrollChar (so it still animates
          // its color, harmlessly) but as plain inline so a line break
          // can occur here.
          const i = tok.idx;
          const charStart = (i / total) * spread;
          const charEnd = ((i + 1) / total) * spread;
          return (
            <ScrollChar
              key={`s-${ti}`}
              progress={scrollYProgress}
              charStart={charStart}
              charEnd={charEnd}
              char={tok.ch}
              restColor={restColor}
              flashColor={flashColor}
              finalColor={finalColor}
              inline
            />
          );
        }
        // Word: inline-block wrapper keeps it from splitting across lines.
        return (
          <span key={`w-${ti}`} style={{ display: "inline-block" }}>
            {tok.chars.map((ch, ci) => {
              const i = tok.startIdx + ci;
              const charStart = (i / total) * spread;
              const charEnd = ((i + 1) / total) * spread;
              return (
                <ScrollChar
                  key={`${ti}-${ci}`}
                  progress={scrollYProgress}
                  charStart={charStart}
                  charEnd={charEnd}
                  char={ch}
                  restColor={restColor}
                  flashColor={flashColor}
                  finalColor={finalColor}
                />
              );
            })}
          </span>
        );
      })}
    </Container>
  );
}

function ScrollChar({
  progress,
  charStart,
  charEnd,
  char,
  // `restColor` is intentionally consumed here only to swallow the
  // prop (no visual contribution any more — see the per-letter timing
  // comment below). Kept on the props so existing call sites compile
  // without changes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  restColor: _restColor,
  flashColor,
  finalColor,
  inline = false,
}: {
  progress: MotionValue<number>;
  charStart: number;
  charEnd: number;
  char: string;
  restColor: string;
  flashColor: string;
  finalColor: string;
  /** When true, render as inline (not inline-block) — used for spaces
   *  so a line break can occur at the whitespace. */
  inline?: boolean;
}) {
  // ONE-LETTER-AT-A-TIME cascade per user direction:
  //   0%   — invisible (opacity 0)
  //   2%   — snap to yellow (opacity 1, color = flash)
  //   92%  — still yellow (color holds at flash for almost the whole slice)
  //   100% — settled at final color
  //
  // The letter is invisible until its slice begins, then pops in
  // YELLOW and stays yellow for 92% of its slice, then fades to final
  // color over the last 8%. The very long yellow hold guarantees the
  // user sees every letter as yellow during the scroll-driven reveal —
  // even on a fast scroll, the actively-revealing letter is solidly
  // yellow at any frame rather than mostly washed-through.
  const slice = charEnd - charStart;
  const popAt = charStart + slice * 0.02;
  const yellowHoldUntil = charStart + slice * 0.92;

  const opacity = useTransform(progress, [charStart, popAt], [0, 1]);
  const color = useTransform(
    progress,
    [charStart, yellowHoldUntil, charEnd],
    [flashColor, flashColor, finalColor],
  );

  return (
    <motion.span
      aria-hidden
      style={{
        // Spaces render inline (so lines can break at them); word-chars
        // render inline-block so transforms / opacities apply per-letter.
        display: inline ? "inline" : "inline-block",
        whiteSpace: char === " " ? "pre" : "normal",
        opacity,
        color,
        willChange: "opacity, color",
      }}
    >
      {char}
    </motion.span>
  );
}

/* ─── Mode 3: shared parent-progress with sub-range ───────────────── */

type SharedProps = {
  chars: string[];
  progress: MotionValue<number>;
  range: [number, number];
  spread: number;
  Tag: "span" | "h1" | "h2" | "h3" | "p";
  className?: string;
  text: string;
  finalColor: string;
  flashColor: string;
  restColor: string;
};

/**
 * Drives the cascade off a parent-supplied MotionValue (e.g., a section's
 * scrollYProgress) constrained to a [rangeStart, rangeEnd] sub-window of
 * 0–1. Multiple SharedProgressCascade instances under the same parent
 * pick non-overlapping ranges to chain — `range=[0, 0.25]` for line A,
 * `[0.3, 0.55]` for line B, `[0.6, 0.85]` for line C — so only one line
 * cascades at a time.
 *
 * Each character then maps its own slice within the line's range using
 * the same scheme as the per-element scroll-linked mode.
 */
function SharedProgressCascade({
  chars,
  progress,
  range,
  spread,
  Tag,
  className,
  text,
  finalColor,
  flashColor,
  restColor,
}: SharedProps) {
  const Container =
    Tag === "h1"
      ? "h1"
      : Tag === "h2"
        ? "h2"
        : Tag === "h3"
          ? "h3"
          : Tag === "p"
            ? "p"
            : "span";

  // Word/space tokenisation — same as ScrollLinkedCascade. Words become
  // inline-block wrappers so line breaks happen only at whitespace.
  type Token =
    | { kind: "space"; ch: string; idx: number }
    | { kind: "word"; chars: string[]; startIdx: number };
  const tokens: Token[] = [];
  let cursor = 0;
  let buffer: string[] = [];
  let bufferStart = 0;
  const flushWord = () => {
    if (buffer.length > 0) {
      tokens.push({ kind: "word", chars: buffer, startIdx: bufferStart });
      buffer = [];
    }
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      flushWord();
      tokens.push({ kind: "space", ch, idx: cursor });
    } else {
      if (buffer.length === 0) bufferStart = cursor;
      buffer.push(ch);
    }
    cursor++;
  }
  flushWord();

  const total = chars.length;
  const [rangeStart, rangeEnd] = range;
  const rangeWidth = Math.max(0.001, rangeEnd - rangeStart);
  // Map a normalized 0–spread fraction inside this cascade's local
  // window onto the parent's global progress range.
  const localToGlobal = (local: number) =>
    rangeStart + (local / spread) * (rangeWidth * spread);
  // Equivalent simplification: rangeStart + local * rangeWidth.
  // We keep the explicit form so it's clear where `spread` enters.

  return (
    <Container
      aria-label={text}
      className={className}
    >
      {tokens.map((tok, ti) => {
        if (tok.kind === "space") {
          const i = tok.idx;
          const charStart = localToGlobal((i / total) * spread);
          const charEnd = localToGlobal(((i + 1) / total) * spread);
          return (
            <ScrollChar
              key={`s-${ti}`}
              progress={progress}
              charStart={charStart}
              charEnd={charEnd}
              char={tok.ch}
              restColor={restColor}
              flashColor={flashColor}
              finalColor={finalColor}
              inline
            />
          );
        }
        return (
          <span key={`w-${ti}`} style={{ display: "inline-block" }}>
            {tok.chars.map((ch, ci) => {
              const i = tok.startIdx + ci;
              const charStart = localToGlobal((i / total) * spread);
              const charEnd = localToGlobal(((i + 1) / total) * spread);
              return (
                <ScrollChar
                  key={`${ti}-${ci}`}
                  progress={progress}
                  charStart={charStart}
                  charEnd={charEnd}
                  char={ch}
                  restColor={restColor}
                  flashColor={flashColor}
                  finalColor={finalColor}
                />
              );
            })}
          </span>
        );
      })}
    </Container>
  );
}

/* ─── Mode 2: trigger (whileInView, fallback) ─────────────────────── */

type TriggerProps = {
  chars: string[];
  Tag: "span" | "h1" | "h2" | "h3" | "p";
  className?: string;
  text: string;
  finalColor: string;
  flashColor: string;
  restColor: string;
  stagger: number;
  duration: number;
  delay: number;
};

const containerVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  visible: {
    transition: {
      delayChildren: delay,
      staggerChildren: stagger,
    },
  },
});

const letterVariants = (
  duration: number,
  rest: string,
  flash: string,
  final: string,
): Variants => ({
  hidden: { opacity: 0, y: "0.25em", color: rest },
  visible: {
    opacity: 1,
    y: 0,
    color: [rest, flash, final],
    transition: {
      duration,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      color: { duration, times: [0, 0.4, 1] },
    },
  },
});

function TriggerCascade({
  chars,
  Tag,
  className,
  text,
  finalColor,
  flashColor,
  restColor,
  stagger,
  duration,
  delay,
}: TriggerProps) {
  const cVariants = useMemo(
    () => containerVariants(stagger, delay),
    [stagger, delay],
  );
  const lVariants = useMemo(
    () => letterVariants(duration, restColor, flashColor, finalColor),
    [duration, restColor, flashColor, finalColor],
  );

  const Container =
    Tag === "h1"
      ? motion.h1
      : Tag === "h2"
        ? motion.h2
        : Tag === "h3"
          ? motion.h3
          : Tag === "p"
            ? motion.p
            : motion.span;

  return (
    <Container
      aria-label={text}
      className={className}
      style={{ display: "inline-block" }}
      variants={cVariants}
      initial="hidden"
      animate="visible"
    >
      {chars.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          aria-hidden
          variants={lVariants}
          style={{
            display: "inline-block",
            whiteSpace: ch === " " ? "pre" : "normal",
            willChange: "transform, opacity, color",
          }}
        >
          {ch}
        </motion.span>
      ))}
    </Container>
  );
}
