'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue } from 'motion/react';
import { CascadeText } from './CascadeText';

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Scroll-linked heading cascade (was one-shot whileInView). The CTA
  // sits at the page tail, so the headline assembles as the operator
  // scrolls down INTO it — same rhythm as Hero / Features / Yos /
  // Benefits / Testimonial / HowItWorks. Cohesion is the point.
  const progress = useMotionValue(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const tick = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const p = (viewH - rect.top) / (viewH + rect.height);
      progress.set(Math.max(0, Math.min(1, p)));
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) raf = requestAnimationFrame(tick);
        else cancelAnimationFrame(raf);
      },
      { threshold: 0 },
    );
    io.observe(section);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [progress]);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.28;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.28;
    btn.style.transform = `translate(${dx}px, ${dy}px)`;
    btn.style.transition = 'transform 0.08s ease';
  };

  const handleMouseEnter = () => {
    const btn = btnRef.current;
    if (!btn) return;
    // On hover the lime brightens slightly and the button's box-shadow
    // grows a soft lime halo — primary CTAs deserve a visible "warmth"
    // bump on intent.
    btn.style.background = '#E8F040';
    btn.style.boxShadow = '0 0 0 2px rgba(212,224,48,0.25), 0 12px 32px rgba(212,224,48,0.35)';
  };

  const handleMouseLeave = () => {
    const btn = btnRef.current;
    if (!btn) return;
    btn.style.transform = 'translate(0, 0)';
    btn.style.transition = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.3s, box-shadow 0.3s';
    btn.style.background = '#D4E030';
    btn.style.boxShadow = '0 0 0 2px rgba(212,224,48,0), 0 6px 18px rgba(212,224,48,0.18)';
  };

  return (
    <section
      ref={sectionRef}
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
          {/* Scroll-linked cascade — reveals as the CTA band passes
              through the viewport. Range [0.30, 0.70] is the
              centered band. */}
          <CascadeText
            text="Your freight moves today."
            progress={progress}
            range={[0.30, 0.70]}
            spread={1}
            finalColor="#fff"
            flashColor="#D4E030"
            restColor="rgba(255,255,255,0.15)"
          />
        </h2>

        <button
          ref={btnRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => {
            const el = document.getElementById('contact');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          style={{
            // Filled lime primary. Was an outline button competing for
            // attention with surrounding white space — primary CTAs at
            // the bottom of a long page benefit from a high-contrast
            // fill that matches the brand mark.
            border: 'none',
            color: '#0A0A0A',
            background: '#D4E030',
            padding: '20px 56px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
            textTransform: 'uppercase',
            borderRadius: '999px',
            cursor: 'pointer',
            transition: 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.3s, box-shadow 0.3s',
            willChange: 'transform',
            boxShadow: '0 6px 18px rgba(212,224,48,0.18)',
          }}
        >
          Get a Quote Today →
        </button>
      </div>
    </section>
  );
}
