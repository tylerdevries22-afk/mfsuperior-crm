'use client';

import { useEffect, useRef, useState } from 'react';

export function YosSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [maxYosSize, setMaxYosSize] = useState(240);

  useEffect(() => {
    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      // How far the top of the section has scrolled above the viewport top
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / (sectionHeight - window.innerHeight)));
      setScrollProgress(progress);
    };

    const handleResize = () => {
      // Cap the zoom-in font size to roughly 70% of viewport width on small screens
      const w = window.innerWidth;
      setMaxYosSize(Math.min(240, Math.round(w * 0.7)));
    };

    handleResize();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleScroll(); // Initial call
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Phase 1: full opacity until 0.4, then fade to 0
  const phase1Opacity = scrollProgress < 0.4
    ? 1
    : Math.max(0, 1 - (scrollProgress - 0.4) / 0.2);

  // Phase 2: invisible until 0.4, then fade to 1
  const phase2Opacity = scrollProgress < 0.4
    ? 0
    : Math.min(1, (scrollProgress - 0.4) / 0.2);

  // MF. font size: interpolate from 48px to maxYosSize as scrollProgress goes 0.4 → 1.0
  const yosProgress = scrollProgress < 0.4 ? 0 : Math.min(1, (scrollProgress - 0.4) / 0.6);
  const yosFontSize = 48 + (maxYosSize - 48) * yosProgress;

  const darkGridStyle: React.CSSProperties = {
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
    backgroundSize: '80px 80px',
  };

  const lightGridStyle: React.CSSProperties = {
    backgroundImage:
      'linear-gradient(rgba(17,17,17,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.05) 1px, transparent 1px)',
    backgroundSize: '80px 80px',
  };

  return (
    <section
      ref={sectionRef}
      className="mkt-yos-section"
      style={{
        position: 'relative',
        height: '200vh',
      }}
    >
      {/* Sticky container */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Phase 1 — Dark */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#111111',
            opacity: phase1Opacity,
            transition: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            ...darkGridStyle,
          }}
        >
          {/* Label */}
          <p
            style={{
              fontSize: '16px',
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'var(--font-primary)',
              fontWeight: 400,
              textAlign: 'center',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}
          >
            That&apos;s the
          </p>

          {/* Main heading */}
          <h2
            style={{
              fontSize: 'clamp(48px, 7vw, 112px)',
              fontWeight: 400,
              color: '#fff',
              fontFamily: 'var(--font-primary)',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              padding: '0 5.128vw',
            }}
          >
            MF Superior Difference.
          </h2>
        </div>

        {/* Phase 2 — Light */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#fff',
            opacity: phase2Opacity,
            transition: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            ...lightGridStyle,
          }}
        >
          {/* Label remains */}
          <p
            style={{
              fontSize: '16px',
              color: 'rgba(17,17,17,0.6)',
              fontFamily: 'var(--font-primary)',
              fontWeight: 400,
              textAlign: 'center',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}
          >
            That&apos;s the
          </p>

          {/* MF. — zooms in */}
          <h2
            style={{
              fontSize: `${yosFontSize}px`,
              fontWeight: 400,
              color: '#000',
              fontFamily: 'var(--font-primary)',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              transition: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            MF.
          </h2>
        </div>
      </div>
    </section>
  );
}
