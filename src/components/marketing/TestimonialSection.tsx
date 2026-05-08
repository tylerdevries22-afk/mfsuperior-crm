'use client';

import { useEffect, useRef } from 'react';
import { CascadeText } from './CascadeText';

export function TestimonialSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const img = imgRef.current;
    if (!section || !img) return;

    let raf = 0;

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const progress = (viewH - rect.top) / (viewH + rect.height);
      const clamped = Math.max(0, Math.min(1, progress));
      img.style.transform = `translateY(${(0.5 - clamped) * 14}%)`;
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

  return (
    <section
      id="about"
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        scrollMarginTop: '80px',
      }}
    >
      {/* Background photo — extra tall for parallax travel */}
      <img
        ref={imgRef}
        src="/images/quote-image.jpg"
        alt="Winter forest with truck"
        style={{
          position: 'absolute',
          top: '-10%',
          left: 0,
          width: '100%',
          height: '120%',
          objectFit: 'cover',
          willChange: 'transform',
        }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.48)',
        }}
      />

      {/* Top-left white notch cutout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '160px',
          height: '60px',
          background: '#fff',
          borderBottomRightRadius: '40px',
        }}
      />

      {/* Top-right white notch cutout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '160px',
          height: '60px',
          background: '#fff',
          borderBottomLeftRadius: '40px',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '100px 5.128vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <blockquote
          style={{
            fontSize: 'clamp(20px, 2.5vw, 36px)',
            fontWeight: 400,
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.45,
            maxWidth: '900px',
            margin: '0 auto 48px',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
            fontStyle: 'normal',
          }}
        >
          <CascadeText
            text="“MF Superior made our distribution seamless. We needed multiple deliveries across Denver in a tight window and they came through every time — professional drivers, on time, no excuses.”"
            stagger={0.012}
            duration={0.45}
            finalColor="#fff"
            flashColor="#D4E030"
            restColor="rgba(255,255,255,0.15)"
          />
        </blockquote>

        <div
          style={{
            width: '40px',
            height: '1px',
            backgroundColor: 'rgba(255,255,255,0.3)',
            marginBottom: '32px',
          }}
        />

        <p
          style={{
            color: '#fff',
            fontSize: '15px',
            textAlign: 'center',
            marginBottom: '4px',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
            letterSpacing: '0.01em',
          }}
        >
          Marcus Webb
        </p>

        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '13px',
            textAlign: 'center',
            marginBottom: '2px',
            fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            letterSpacing: '0.08em',
          }}
        >
          Operations Manager
        </p>

        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '13px',
            textAlign: 'center',
            fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            letterSpacing: '0.08em',
          }}
        >
          Denver Direct Logistics
        </p>
      </div>
    </section>
  );
}
