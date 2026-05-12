'use client';

import { useEffect, useRef, useState } from 'react';
import { CascadeText } from './CascadeText';

type Step = {
  num: string;
  label: string;
  heading: string;
  description: string;
  video: string;
};

// Customer journey, mapped 1:1 onto the three existing wide videos.
// Each step gets one viewport (100vh) of scroll travel inside a 300vh
// outer track; the inner panel is `position: sticky` so the text+video
// stay pinned while the scroll position drives `activeStep`.
const STEPS: Step[] = [
  {
    num: '01',
    label: 'Inquiry & Quote',
    heading: 'Tell us what needs to move',
    description:
      "Send a quick note about your freight — pickup, drop-off, weight, timing. We respond with a transparent, no-broker rate the same business day. No back-and-forth, no hidden fees.",
    video: '/videos/features-01.mp4',
  },
  {
    num: '02',
    label: 'Schedule & Dispatch',
    heading: 'Confirmed and on the road within the week',
    description:
      "Once you approve the quote, we lock in a date and assign one of our insured, professional drivers. 16ft to 26ft capacity across the Denver metro and beyond — your operation never waits on a carrier.",
    video: '/videos/benefit-02-wide.mp4',
  },
  {
    num: '03',
    label: 'Delivery',
    heading: 'Delivered on time, billed clean',
    description:
      "Your freight arrives when we said it would. You get a clear invoice that matches the quote — no surprise line items, no broker fees. Repeat or one-off, we price it so it makes sense from day one.",
    video: '/videos/benefit-03-wide.mp4',
  },
];

export function BenefitsSection() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [activeStep, setActiveStep] = useState(0);

  // Map scroll position within the outer track to an integer step index.
  // Track is N×100vh tall and the inner panel is 100vh sticky, so the
  // first (track.height − 100vh) of scroll is the navigable range; we
  // divide that into N equal slices, one per step.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = -rect.top;
      const max = rect.height - viewH;
      const progress = max > 0 ? Math.min(1, Math.max(0, scrolled / max)) : 0;
      const next = Math.min(
        STEPS.length - 1,
        Math.floor(progress * STEPS.length),
      );
      setActiveStep((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Only play the active video; pause the others so we're not decoding
  // three streams at once. Autoplay may be blocked when the tab is
  // backgrounded — swallow the rejection.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeStep) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeStep]);

  return (
    <section
      id="how-it-works"
      style={{ scrollMarginTop: '80px', position: 'relative' }}
    >
      {/* Intro header */}
      <div style={{ padding: '120px 5.128vw 0', background: 'transparent' }}>
        <span
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#7f7f7f',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '16px',
          }}
        >
          How it works
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-primary)',
            fontSize: 'clamp(32px, 4vw, 56px)',
            fontWeight: 400,
            lineHeight: 1.1,
            color: '#111111',
            maxWidth: '900px',
          }}
        >
          <CascadeText
            text="From inquiry to delivery in three clean steps."
            finalColor="#111111"
            flashColor="#D4E030"
            restColor="rgba(17,17,17,0.18)"
            spread={0.6}
            offset={['start 90%', 'start 50%']}
          />
        </h2>
      </div>

      {/* Desktop: scrolly track. Outer is N×100vh tall; inner is sticky. */}
      <div
        ref={trackRef}
        className="mkt-process-track"
        style={{
          position: 'relative',
          height: `${STEPS.length * 100}vh`,
          marginTop: '64px',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '64px',
            padding: '0 5.128vw',
            alignItems: 'center',
          }}
        >
          {/* Left: step text + progress rail */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              maxWidth: '560px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#7f7f7f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Step {STEPS[activeStep].num} / 0{STEPS.length}
              </span>
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                aria-hidden
              >
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: i === activeStep ? '32px' : '8px',
                      height: '8px',
                      borderRadius: '999px',
                      background:
                        i <= activeStep
                          ? 'var(--c-lime)'
                          : 'rgba(17,17,17,0.12)',
                      transition:
                        'width 0.4s var(--ease-reveal), background 0.4s var(--ease-reveal)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Step content — all rendered, fade between active */}
            <div
              style={{ position: 'relative', minHeight: '280px' }}
              aria-live="polite"
            >
              {STEPS.map((step, i) => {
                const active = i === activeStep;
                return (
                  <div
                    key={step.num}
                    aria-hidden={!active}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: active ? 1 : 0,
                      transform: active ? 'translateY(0)' : 'translateY(16px)',
                      transition:
                        'opacity 0.5s var(--ease-transition), transform 0.5s var(--ease-reveal)',
                      pointerEvents: active ? 'auto' : 'none',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 16px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: '#7f7f7f',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {step.label}
                    </p>
                    <h3
                      style={{
                        margin: '0 0 20px 0',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 'clamp(28px, 3vw, 44px)',
                        fontWeight: 400,
                        lineHeight: 1.15,
                        color: '#111111',
                      }}
                    >
                      {step.heading}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-primary)',
                        fontSize: '16px',
                        lineHeight: 1.7,
                        color: '#7f7f7f',
                        maxWidth: '500px',
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: video panel — crossfade between three streams */}
          <div
            style={{
              position: 'relative',
              height: '70vh',
              maxHeight: '640px',
              borderRadius: '20px',
              overflow: 'hidden',
              background: '#111111',
              boxShadow: '0 24px 64px rgba(17,17,17,0.12)',
            }}
          >
            {STEPS.map((step, i) => (
              <video
                key={step.num}
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={step.video}
                muted
                loop
                playsInline
                preload="metadata"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: i === activeStep ? 1 : 0,
                  transition: 'opacity 0.6s var(--ease-transition)',
                }}
              />
            ))}
            <span
              style={{
                position: 'absolute',
                left: '20px',
                top: '20px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.12em',
                background: 'rgba(0,0,0,0.4)',
                padding: '6px 12px',
                borderRadius: '999px',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {STEPS[activeStep].num} · {STEPS[activeStep].label}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile: stacked cards (no sticky / no scrubbing) */}
      <div
        className="mkt-process-mobile"
        style={{ display: 'none', padding: '32px 6vw 80px' }}
      >
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '32px 0',
              borderTop: i === 0 ? 'none' : '1px solid #e5e5e5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#7f7f7f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Step {step.num}
              </span>
              <span
                style={{
                  width: '24px',
                  height: '2px',
                  background: 'var(--c-lime)',
                  borderRadius: '999px',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#7f7f7f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {step.label}
              </span>
            </div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-primary)',
                fontSize: 'clamp(22px, 5vw, 28px)',
                fontWeight: 400,
                lineHeight: 1.2,
                color: '#111111',
              }}
            >
              {step.heading}
            </h3>
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#111111',
              }}
            >
              <video
                src={step.video}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-primary)',
                fontSize: '15px',
                lineHeight: 1.65,
                color: '#7f7f7f',
              }}
            >
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
