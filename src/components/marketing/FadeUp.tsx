"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * Generic scroll-triggered fade + slide-up wrapper for marketing
 * blocks (subheadline copy, image groups, button rows). Pairs well
 * with CascadeText on the headline above it — the headline letters
 * cascade in, then the body block lifts into place a beat later.
 *
 * Defaults are tuned for a slightly slower, "editorial" feel — short
 * travel (24px), mid-long ease (0.7s with custom cubic). Use `delay`
 * to chain elements within a section.
 */

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Wrapper tag. Default "div". */
  as?: "div" | "section" | "article" | "li";
  /** Repeat each time it scrolls into view? Default false. */
  repeat?: boolean;
  /** How much of the element must be visible before it fires (0–1). */
  amount?: number;
  style?: React.CSSProperties;
};

export function FadeUp({
  children,
  delay = 0,
  className,
  as: Tag = "div",
  repeat = false,
  amount = 0.25,
  style,
}: Props) {
  const Component =
    Tag === "section"
      ? motion.section
      : Tag === "article"
        ? motion.article
        : Tag === "li"
          ? motion.li
          : motion.div;

  return (
    <Component
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: !repeat, amount }}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </Component>
  );
}
