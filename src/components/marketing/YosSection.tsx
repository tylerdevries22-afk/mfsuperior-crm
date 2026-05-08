'use client';

import { useEffect, useRef } from 'react';
import { CascadeText } from './CascadeText';

export function YosSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const mfTextRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / (sectionHeight - window.innerHeight)));

      const phase1Opacity = progress < 0.4
        ? 1
        : Math.max(0, 1 - (progress - 0.4) / 0.2);
      const phase2Opacity = progress < 0.4
        ? 0
        : Math.min(1, (progress - 0.4) / 0.2);
      const yosProgress = progress < 0.4 ? 0 : Math.min(1, (progress - 0.4) / 0.6);
      const yosFontSize = 48 + (240 - 48) * yosProgress;

      if (phase1Ref.current) phase1Ref.current.style.opacity = String(phase1Opacity);
      if (phase2Ref.current) phase2Ref.current.style.opacity = String(phase2Opacity);
      if (mfTextRef.current) mfTextRef.current.style.fontSize = `${yosFontSize}px`;

      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) raf = requestAnimationFrame(tick);
        else cancelAnimationFrame(raf);
      },
      { threshold: 0 }
    );
    io.observe(section);

    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

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
          ref={phase1Ref}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#111111',
            opacity: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            ...darkGridStyle,
          }}
        >
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

          <h2
            style={{
              fontSize: 'clamp(48px, 7vw, 112px)',
              fontWeight: 400,
              fontFamily: 'var(--font-primary)',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              padding: '0 5.128vw',
              color: '#fff',
            }}
          >
            <CascadeText
              text="MF Superior Difference."
              scrollLinked
              spread={0.6}
              offset={['start 85%', 'start 35%']}
              finalColor="#fff"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.18)"
            />
          </h2>
        </div>

        {/* Phase 2 — Light */}
        <div
          ref={phase2Ref}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#fff',
            opacity: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            ...lightGridStyle,
          }}
        >
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

          <h2
            ref={mfTextRef}
            style={{
              fontSize: '48px',
              fontWeight: 400,
              color: '#000',
              fontFamily: 'var(--font-primary)',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
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
