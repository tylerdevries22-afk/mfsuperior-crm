'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue } from 'motion/react';
import { CascadeText } from './CascadeText';

export function YosSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const mfTextRef = useRef<HTMLHeadingElement>(null);

  // Exposed scroll progress for the "Superior Products" cascade. Updated
  // inside the RAF tick below so the cascade fires off the same scroll
  // signal that drives phase swap + MF font-size — no double useScroll.
  const sectionProgress = useMotionValue(0);

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
      // MF text grows from 0.4 → 0.7 of section progress (was 0.4 → 1.0).
      // This compresses the size animation into the first 70% of the
      // section so the LAST 30% can be reserved for the "Superior
      // Products" cascade — kicking in only after MF has already
      // reached its full size at progress = 0.7.
      const yosProgress = progress < 0.4 ? 0 : Math.min(1, (progress - 0.4) / 0.3);
      const yosFontSize = 48 + (240 - 48) * yosProgress;

      if (phase1Ref.current) phase1Ref.current.style.opacity = String(phase1Opacity);
      if (phase2Ref.current) phase2Ref.current.style.opacity = String(phase2Opacity);
      if (mfTextRef.current) mfTextRef.current.style.fontSize = `${yosFontSize}px`;
      sectionProgress.set(progress);

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
  }, [sectionProgress]);

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
        // 200vh → 160vh trim. The phase swap + MF size animation +
        // Superior Products cascade all happen within this scroll
        // runway (mapped via the existing yosProgress curve), so a
        // shorter section just compresses how much the user has to
        // scroll without changing the *feel* of any animation. Cuts
        // 40vh of dead scroll between Features and Benefits.
        position: 'relative',
        height: '160vh',
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
              text="Superior Difference."
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
            That&apos;s
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

          {/*
            Lime tagline beneath the giant MF. — three coordinated effects:

            1. Cascade is bound to the section's own progress MotionValue
               with range [0.72, 0.92]. yosProgress (the MF font-size
               curve) reaches 1.0 at section progress 0.70, so the cascade
               starts only AFTER MF has hit its full size — no overlap.
            2. Color is a richer, more saturated yellow (#B8C200) that
               reads cleanly on the white phase-2 background while still
               reading as "yellow" instead of olive.
            3. A shimmer overlay (.mf-shimmer-text via globals.css) runs
               a sliding hot-spot across the text continuously. It uses
               ::after { content: attr(data-text) } and a moving
               linear-gradient mask to paint a bright sweep on top of the
               settled cascade text — gives the lime a polished
               "in-motion" feel without disturbing the cascade's reveal.
          */}
          <p
            className="mf-shimmer-text"
            data-text="Superior Products"
            style={{
              fontSize: 'clamp(22px, 2.7vw, 38px)',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              textAlign: 'center',
              margin: '32px 0 0 0',
              lineHeight: 1.1,
              letterSpacing: '0.01em',
              color: '#B8C200',
            }}
          >
            <CascadeText
              text="Superior Products"
              progress={sectionProgress}
              range={[0.72, 0.92]}
              spread={1}
              finalColor="#B8C200"
              flashColor="#D4E030"
              restColor="rgba(184,194,0,0.12)"
            />
          </p>
        </div>
      </div>
    </section>
  );
}
