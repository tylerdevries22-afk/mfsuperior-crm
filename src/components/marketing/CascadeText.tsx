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
  stagger = 0.03,
  duration = 0.5,
  delay = 0,
}: Props) {
  const chars = useMemo(() => Array.from(text), [text]);
  const ref = useRef<HTMLElement>(null);

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
  restColor,
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
  // Match terminal-industries.com timing exactly. Each character has
  // three keyframe stops within its slice of scroll progress:
  //   0%  — rest (invisible / bg-matching color)
  //   30% — flash (lime peak, pronounced)
  //   100% — final (white at rest, visible at top)
  //
  // The letter "pops in lime, then settles white" — that's what the
  // user wants and what the reference site does.
  const slice = charEnd - charStart;
  const flashAt = charStart + slice * 0.3;
  const opacityFull = charStart + slice * 0.15; // pop in fast, no slow fade

  const opacity = useTransform(
    progress,
    [charStart, opacityFull],
    [0, 1],
  );
  const color = useTransform(
    progress,
    [charStart, flashAt, charEnd],
    [restColor, flashColor, finalColor],
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
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
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
