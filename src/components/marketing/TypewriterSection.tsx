'use client';

import { useEffect, useRef, useState } from 'react';

const TEXT = 'across Colorado, straight to your customers.';

export function TypewriterSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const chars = TEXT.split('');
  const totalDuration = chars.length * 0.04 + 0.8; // last char delay + animation duration

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

      {/* Text container */}
      <div
        ref={ref}
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
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            style={{
              color: '#ddd',
              animation: inView
                ? `color-transition 0.8s ${(i * 0.04).toFixed(3)}s forwards`
                : 'none',
              display: char === ' ' ? 'inline' : 'inline',
              whiteSpace: char === ' ' ? 'pre' : undefined,
            }}
          >
            {char}
          </span>
        ))}

        {/* Blinking cursor — appears after last character animation completes */}
        <span
          style={{
            color: '#D4E030',
            animation: inView
              ? `cursor-blink 1s ${totalDuration.toFixed(3)}s infinite`
              : 'none',
            opacity: inView ? undefined : 0,
            marginLeft: '2px',
          }}
        >
          |
        </span>
      </div>
    </section>
  );
}
