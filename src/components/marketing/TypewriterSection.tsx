'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { CascadeText } from './CascadeText';

const TEXT = 'across Colorado, straight to your customers.';

/**
 * White-panel pull-quote that scrolls UP over the FIXED hero
 * stage that precedes it in the page tree.
 *
 *   1. `marginTop: -100vh` — the panel starts overlapping the
 *      hero by a full viewport height. As the user scrolls past
 *      the hero runway, this panel scrolls UP across the still-
 *      visible hero video, eventually covering it entirely.
 *   2. `position: relative; zIndex: 10` — layers on top of the
 *      fixed hero so the white background reads cleanly.
 *   3. Rounded top corners + soft shadow for a "sheet rising"
 *      look as it overtakes the hero.
 *   4. Inner text wrapper uses a scroll-linked opacity so the
 *      cascade text fades IN as the panel approaches the
 *      viewport top — synchronized with the hero headline
 *      fading OUT (in HeroSection.tsx's rAF loop). The two
 *      text states visually swap.
 */
export function TypewriterSection() {
  const ref = useRef<HTMLElement>(null);

  // Track scroll progress as the panel's TOP edge transitions
  // from "just below viewport" (start end) to "fully at
  // viewport top" (start start). Used for both the parallax
  // and the cascade-text opacity fade-in.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start start'],
  });

  // Parallax lift kept from the prior iteration so the panel
  // reads as "rising" not "sliding flat" while it enters.
  const y = useTransform(scrollYProgress, [0, 1], [80, 0], { clamp: true });

  // Cascade text fades IN over the LAST third of the panel's
  // approach. By the time the panel's top has reached the
  // viewport top (scrollYProgress = 1), opacity = 1. This
  // matches the hero headline's fade-OUT window driven from
  // HeroSection.tsx (sectionProgress 0.7 → 1.0), so the
  // operator sees the two text states visually trade.
  const textOpacity = useTransform(scrollYProgress, [0.6, 1], [0, 1], {
    clamp: true,
  });

  return (
    <motion.section
      ref={ref}
      style={{
        background: '#fff',
        borderTopLeftRadius: '40px',
        borderTopRightRadius: '40px',
        // Full-viewport overlap so the panel SLIDES UP over the
        // fixed hero stage (previously -120px, which was a tiny
        // visual nibble and let the hero scroll off behind it).
        marginTop: '-100vh',
        position: 'relative',
        // Above the fixed hero (zIndex 0) so the white panel
        // reads cleanly on top.
        zIndex: 10,
        boxShadow: '0 -32px 60px -32px rgba(0, 0, 0, 0.7)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        y,
        willChange: 'transform',
      }}
    >
      {/* Subtle dark-on-white grid pattern. */}
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

      {/* Headline. Wrapper opacity is scroll-linked so the
          cascade text fades in as the panel arrives, synced
          with the hero headline's fade out. */}
      <motion.div
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
          opacity: textOpacity,
          willChange: 'opacity',
        }}
      >
        <CascadeText
          text={TEXT}
          scrollLinked
          spread={0.6}
          offset={['start 90%', 'start 30%']}
          finalColor="#0F1A1A"
          flashColor="#D4E030"
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
      </motion.div>
    </motion.section>
  );
}
