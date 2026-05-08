"use client";

import { motion, type Variants } from "motion/react";
import { useMemo } from "react";

/**
 * Per-character cascade reveal — gray → lime flash → white — driven by
 * scroll. Mirrors the technique used on terminal-industries.com:
 * each character is its own inline-block span, animated with a per-letter
 * stagger so the eye traces the headline left-to-right.
 *
 * The mid-keyframe lime "flash" is what gives the line that
 * "lights up as it's read" feel. Keep stagger small (~25–35ms) on long
 * lines so the sweep doesn't drag.
 *
 * Accessibility: respects prefers-reduced-motion via @media in globals.css
 * (already wired). The plain text is rendered into the DOM (no aria
 * tricks needed); each character span is aria-hidden via the wrapping
 * <span aria-label> so screen readers read the whole string once.
 */

type Props = {
  text: string;
  /** Delay before the cascade starts, in seconds. Use to chain headlines. */
  delay?: number;
  /** Per-character stagger in seconds. Default 0.03. */
  stagger?: number;
  /** Single-character animation duration in seconds. Default 0.5. */
  duration?: number;
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
  /** Repeat each time it scrolls into view? Default false (one-shot). */
  repeat?: boolean;
};

/** Container variant — orchestrates the per-letter stagger. */
const containerVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  visible: {
    transition: {
      delayChildren: delay,
      staggerChildren: stagger,
    },
  },
});

/** Per-letter variant — color flashes to lime mid-anim, then settles. */
const letterVariants = (
  duration: number,
  rest: string,
  flash: string,
  final: string,
): Variants => ({
  hidden: {
    opacity: 0,
    y: "0.25em",
    color: rest,
  },
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

export function CascadeText({
  text,
  delay = 0,
  stagger = 0.03,
  duration = 0.5,
  className,
  as: Tag = "span",
  finalColor = "#fff",
  flashColor = "#D4E030",
  restColor = "rgba(255,255,255,0.18)",
  repeat = false,
}: Props) {
  // Memoize the split so we don't re-allocate on every render.
  const chars = useMemo(() => Array.from(text), [text]);
  const cVariants = useMemo(
    () => containerVariants(stagger, delay),
    [stagger, delay],
  );
  const lVariants = useMemo(
    () => letterVariants(duration, restColor, flashColor, finalColor),
    [duration, restColor, flashColor, finalColor],
  );

  // Use whileInView so the cascade triggers as the headline scrolls past
  // the fold; once: true makes it one-shot for headline copy.
  // We render the per-letter spans inside whichever tag the caller asked
  // for — h1/h2/h3/p/span — by selecting the matching motion.* component.
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
      viewport={{ once: !repeat, amount: 0.4 }}
    >
      {chars.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          aria-hidden
          variants={lVariants}
          style={{
            display: "inline-block",
            // White-space-preserving render for spaces.
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
