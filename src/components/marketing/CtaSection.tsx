'use client';

import { useState } from 'react';
import { CascadeText } from './CascadeText';

export function CtaSection() {
  const [hovered, setHovered] = useState(false);

  return (
    <section
      style={{
        background: '#111111',
        padding: '120px 5.128vw 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Top-left white notch cutout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '140px',
          height: '56px',
          background: '#fff',
          borderBottomRightRadius: '32px',
          zIndex: 1,
        }}
      />

      {/* Top-right white notch cutout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '140px',
          height: '56px',
          background: '#fff',
          borderBottomLeftRadius: '32px',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(40px, 6vw, 96px)',
            fontWeight: 400,
            textAlign: 'center',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: '900px',
            margin: '0 auto 48px',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
            color: '#fff',
          }}
        >
          <CascadeText
            text="Your freight moves today."
            stagger={0.028}
            duration={0.55}
            finalColor="#fff"
            flashColor="#D4E030"
            restColor="rgba(255,255,255,0.15)"
          />
        </h2>

        <button
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            border: '2px solid rgba(255,255,255,0.4)',
            color: '#fff',
            background: hovered ? 'rgba(255,255,255,0.1)' : 'transparent',
            padding: '18px 40px',
            fontSize: '12px',
            letterSpacing: '0.18em',
            fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            textTransform: 'uppercase',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background 0.3s',
          }}
        >
          GET A QUOTE TODAY
        </button>
      </div>
    </section>
  );
}
