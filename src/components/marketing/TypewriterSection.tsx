'use client';

import { CascadeText } from './CascadeText';

const TEXT = 'across Colorado, straight to your customers.';

/**
 * Full-bleed pull-quote between hero and Features. The cascade is
 * scroll-linked — each character reveals as the section scrolls past.
 * Ends in WHITE on a black background so the line stays visible at
 * rest after the cascade completes (previously ended dark-green via
 * the legacy `color-transition` keyframe = invisible on black).
 */
export function TypewriterSection() {
  return (
    <section
      style={{
        background: '#000',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
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
          color: '#fff',
        }}
      >
        <CascadeText
          text={TEXT}
          scrollLinked
          spread={0.6}
          // The cascade plays as the headline travels from the bottom
          // of the viewport (start) up to ~30% from top (end).
          offset={['start 90%', 'start 30%']}
          finalColor="#fff"
          flashColor="#D4E030"
          restColor="rgba(255,255,255,0.18)"
        />
        {/* Static lime cursor at line end — stays visible after cascade. */}
        <span
          aria-hidden
          style={{
            color: '#D4E030',
            marginLeft: '2px',
            animation: 'cursor-blink 1s 0s infinite',
          }}
        >
          |
        </span>
      </div>
    </section>
  );
}
