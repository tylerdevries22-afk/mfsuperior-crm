'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { CascadeText } from './CascadeText';

const TEXT = 'across Colorado, straight to your customers.';

/**
 * White-panel pull-quote that slides UP over the tail of the hero
 * with parallax — terminal-industries.com style. Three forces
 * combine to sell the "panel rising over hero" feel:
 *
 *   1. marginTop: -120px so the white panel naturally overlaps the
 *      bottom of the hero by a meaningful amount (large enough that
 *      the rounded top corners read clearly against the dark video).
 *   2. borderTopLeftRadius / borderTopRightRadius: 40px so the
 *      panel reads as a "sheet" with curved edges, not a flat block.
 *   3. A scroll-linked translateY parallax: while the section's top
 *      is between viewport-bottom and viewport-mid, we offset the
 *      whole section downward by up to 80px and animate it back to 0
 *      as the user scrolls. So as you scroll into it, the section
 *      visually "rises" instead of just sliding linearly with the
 *      page. zIndex 5 keeps it above the hero so the rounded corners
 *      cut out the dark video underneath.
 */
export function TypewriterSection() {
  const ref = useRef<HTMLElement>(null);

  // Track scroll while the section's top edge crosses the viewport
  // from "just appearing at the bottom" to "settled in the middle".
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start 30%'],
  });

  // While entering: translate the section down by up to 80px (so it
  // appears to "rise" as the user scrolls). Settles to 0 by the time
  // its top reaches 30% of viewport. Clamped so the panel doesn't
  // overshoot once the user has scrolled past it.
  const y = useTransform(scrollYProgress, [0, 1], [80, 0], { clamp: true });

  return (
    <motion.section
      ref={ref}
      style={{
        background: '#fff',
        borderTopLeftRadius: '40px',
        borderTopRightRadius: '40px',
        marginTop: '-120px',
        position: 'relative',
        zIndex: 5,
        // Soft top-edge shadow so the rounded corners read as elevated
        // when they overlap the dark hero. Subtle but visible against
        // the video frames.
        boxShadow: '0 -32px 60px -32px rgba(0, 0, 0, 0.7)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        // Parallax lift: animate transform: translateY(...) tied to
        // section scroll progress.
        y,
        willChange: 'transform',
      }}
    >
      {/* Subtle dark-on-white grid pattern (matches FeaturesSection
          and BenefitsSection visual language). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(17,17,17,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.045) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      {/* Headline */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 'clamp(32px, 5.5vw, 88px)',
          fontWeight: 400,
          lineHeight: 1.1,
          textAlign: 'center',
          padding: '0 5.128vw',
          maxWidth: '1200px',
          fontFamily: 'var(--font-primary)',
          color: '#0F1A1A',
          letterSpacing: '-0.01em',
        }}
      >
        <CascadeText
          text={TEXT}
          scrollLinked
          spread={0.6}
          offset={['start 90%', 'start 30%']}
          finalColor="#0F1A1A"
          flashColor="#A0B41E"
          restColor="rgba(15,26,26,0.14)"
        />
        <span
          aria-hidden
          style={{
            color: '#A0B41E',
            marginLeft: '2px',
            animation: 'cursor-blink 1s 0s infinite',
          }}
        >
          |
        </span>
      </div>
    </motion.section>
  );
}
