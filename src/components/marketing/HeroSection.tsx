'use client';

import { useEffect, useState } from 'react';

export function HeroSection() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const layerAOpacity = Math.max(0, Math.min(1, 1 - scrollY / 600));
  const layerBOpacity = Math.max(0, Math.min(1, scrollY / 600));

  return (
    <section
      className="mkt-hero-section"
      style={{
        position: 'relative',
        minHeight: '200vh',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {/* Layer A: dark navy/steel gradient (visible at top) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, #1c1c1c, #161616, #111111)',
          opacity: layerAOpacity,
          transition: 'none',
        }}
      >
        {/* Dark overlay at bottom for text legibility */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* Layer B: near-black with wireframe truck video */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#0a0a0a',
          opacity: layerBOpacity,
          transition: 'none',
        }}
      >
        <video
          src="/videos/features-01.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {/* Dark overlay for text legibility over video */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 80%)',
          }}
        />
      </div>

      {/* Sticky text container — stays visible within the 200vh scroll space */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {/* Main text block */}
        <div
          className="mkt-hero-text"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '0 5.128vw 80px',
          }}
        >
          {/* Small label above heading */}
          <p
            className="mkt-hero-label"
            style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '8px',
              fontFamily: 'var(--font-primary)',
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            Colorado&apos;s most trusted freight delivery partner
          </p>

          {/* Large display heading */}
          <h1
            style={{
              fontSize: 'clamp(36px, 6vw, 96px)',
              fontWeight: 400,
              color: '#fff',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-primary)',
              margin: 0,
            }}
          >
            Built for the work ahead.
            <br />
            Delivery that doesn&apos;t quit.
          </h1>
        </div>

        {/* SCROLL TO EXPLORE label */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          }}
        >
          Scroll to Explore
        </div>
      </div>
    </section>
  );
}
