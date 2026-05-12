'use client';

import { useEffect, useRef, useState } from 'react';
import { CascadeText } from './CascadeText';

type Step = {
  num: string;
  label: string;
  heading: string;
  /** Single emphatic line under the heading — the "elevator pitch"
   *  for this step. Tighter than the old prose paragraph. */
  tagline: string;
  /** 3 scannable bullets replacing the old paragraph body. Each one
   *  is a single noun-phrase or short sentence — operators can read
   *  the whole step in ~3 seconds. */
  bullets: string[];
  video: string;
};

// Customer journey, mapped 1:1 onto the three existing wide videos.
// Copy condensed from the previous prose to a heading + tagline + 3
// bullets per step so the section reads in seconds on either form
// factor.
const STEPS: Step[] = [
  {
    num: '01',
    label: 'Inquiry & Quote',
    heading: 'Tell us what needs to move',
    tagline: 'Same-day quote. No brokers.',
    bullets: [
      'Send pickup, drop-off, weight, timing',
      'Flat rate the same business day',
      'No back-and-forth. No hidden fees.',
    ],
    video: '/videos/features-01.mp4',
  },
  {
    num: '02',
    label: 'Schedule & Dispatch',
    heading: 'On the road within the week',
    tagline: 'Insured drivers. 16–26 ft capacity.',
    bullets: [
      'Approve the quote, we lock in a date',
      'Professional drivers — no subcontracting',
      'Denver metro and beyond, on your schedule',
    ],
    video: '/videos/benefit-02-wide.mp4',
  },
  {
    num: '03',
    label: 'Delivery',
    heading: 'Delivered on time, billed clean',
    tagline: 'No surprise charges. Ever.',
    bullets: [
      'On-time delivery to your dock',
      'Clear invoice that matches the quote',
      'One-off or recurring — same pricing',
    ],
    video: '/videos/benefit-03-wide.mp4',
  },
];

export function BenefitsSection() {
  // Desktop: scroll position within `trackRef` (a 300vh tall outer
  // container) determines which step is active for the sticky panel.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const desktopVideoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [activeStep, setActiveStep] = useState(0);

  // Mobile: each step renders as its own card; an IntersectionObserver
  // tracks which card is most-visible to drive a highlight state +
  // play/pause the matching inline video.
  const mobileCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mobileVideoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [mobileActiveStep, setMobileActiveStep] = useState(0);

  // ── Desktop scroll listener ─────────────────────────────────────
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

  // ── Mobile IntersectionObserver ─────────────────────────────────
  // Observes every step card and picks whichever is currently most
  // intersecting — that becomes the highlighted step. Threshold list
  // gives smooth handoff as the user scrolls between cards.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        let best = visible[0];
        for (const e of visible) {
          if (e.intersectionRatio > best.intersectionRatio) best = e;
        }
        const idx = mobileCardRefs.current.findIndex(
          (r) => r === best.target,
        );
        if (idx >= 0) {
          setMobileActiveStep((prev) => (prev === idx ? prev : idx));
        }
      },
      {
        // Activate when ~mid-screen; deactivate when leaving viewport.
        rootMargin: '-25% 0px -25% 0px',
        threshold: [0.1, 0.3, 0.5, 0.7],
      },
    );
    mobileCardRefs.current.forEach((r) => r && observer.observe(r));
    return () => observer.disconnect();
  }, []);

  // ── Play active video on desktop, pause others ──────────────────
  useEffect(() => {
    desktopVideoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeStep) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeStep]);

  // ── Play active video on mobile, pause others ───────────────────
  useEffect(() => {
    mobileVideoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === mobileActiveStep) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [mobileActiveStep]);

  return (
    <section
      id="how-it-works"
      style={{ scrollMarginTop: '80px', position: 'relative' }}
    >
      {/* ── Intro header ────────────────────────────────────────── */}
      <div className="mkt-process-intro" style={{ padding: '120px 5.128vw 0' }}>
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
            fontSize: 'clamp(30px, 4vw, 56px)',
            fontWeight: 400,
            lineHeight: 1.05,
            color: '#111111',
            maxWidth: '900px',
            letterSpacing: '-0.02em',
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

      {/* ── Desktop: sticky split-screen scrollytelling ─────────── */}
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
            gridTemplateColumns: '64px 1fr 1fr',
            gap: '48px',
            padding: '0 5.128vw',
            alignItems: 'center',
          }}
        >
          {/* Left: vertical step rail */}
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'center',
            }}
            aria-label="Steps"
          >
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isPast = i < activeStep;
              return (
                <li
                  key={step.num}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span
                    aria-current={isActive ? 'step' : undefined}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: isActive ? '20px' : '13px',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? 'var(--c-dark-green)'
                        : isPast
                          ? 'rgba(17,17,17,0.55)'
                          : 'rgba(17,17,17,0.28)',
                      letterSpacing: '0.05em',
                      transition: 'all 0.4s var(--ease-reveal)',
                    }}
                  >
                    {step.num}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        width: '2px',
                        height: '56px',
                        background:
                          isPast || isActive
                            ? 'var(--c-lime)'
                            : 'rgba(17,17,17,0.12)',
                        borderRadius: '999px',
                        transition: 'background 0.5s var(--ease-reveal)',
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Center: step content + giant ghost number behind it */}
          <div style={{ position: 'relative', maxWidth: '560px' }}>
            {/* Decorative oversized active step number, lime stroke
                only — sits behind the text and pops the active step
                visually without competing for attention. */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '-72px',
                left: '-32px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(180px, 18vw, 280px)',
                fontWeight: 700,
                lineHeight: 1,
                color: 'transparent',
                WebkitTextStroke: '1.5px rgba(212, 224, 48, 0.35)',
                letterSpacing: '-0.04em',
                userSelect: 'none',
                pointerEvents: 'none',
                zIndex: 0,
                transition: 'all 0.5s var(--ease-reveal)',
              }}
            >
              {STEPS[activeStep].num}
            </span>

            {/* Live region: text content with crossfade between steps. */}
            <div
              style={{ position: 'relative', zIndex: 1, minHeight: '320px' }}
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
                      transform: active
                        ? 'translateY(0)'
                        : 'translateY(16px)',
                      transition:
                        'opacity 0.5s var(--ease-transition), transform 0.5s var(--ease-reveal)',
                      pointerEvents: active ? 'auto' : 'none',
                    }}
                  >
                    {/* Label row: lime accent dash + step number + label */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '16px',
                      }}
                    >
                      <span
                        style={{
                          width: '32px',
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
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                        }}
                      >
                        Step {step.num} · {step.label}
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: '0 0 14px 0',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 'clamp(30px, 3.4vw, 52px)',
                        fontWeight: 400,
                        lineHeight: 1.05,
                        color: '#111111',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {step.heading}
                    </h3>

                    {/* Tagline — single emphatic line, darker than the bullets */}
                    <p
                      style={{
                        margin: '0 0 24px 0',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 'clamp(16px, 1.3vw, 19px)',
                        lineHeight: 1.35,
                        color: 'var(--c-dark-green)',
                        fontWeight: 500,
                      }}
                    >
                      {step.tagline}
                    </p>

                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {step.bullets.map((b, j) => (
                        <li
                          key={j}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            fontFamily: 'var(--font-primary)',
                            fontSize: '15px',
                            lineHeight: 1.5,
                            color: '#7f7f7f',
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              flexShrink: 0,
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--c-lime)',
                              marginTop: '8px',
                            }}
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: video panel — crossfades between three streams */}
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
                  desktopVideoRefs.current[i] = el;
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

      {/* ── Mobile: scroll-driven card stack ────────────────────── */}
      <div
        className="mkt-process-mobile"
        style={{ display: 'none', position: 'relative' }}
      >
        {/* Sticky progress pill at the top of the mobile section.
            Stays in viewport while the user scrolls between cards;
            scrolls away when the section ends. */}
        <div
          className="mkt-process-pill-wrap"
          style={{
            position: 'sticky',
            top: '88px',
            zIndex: 5,
            padding: '0 6vw 16px',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(17,17,17,0.06)',
              boxShadow: '0 8px 20px rgba(17,17,17,0.06)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#111',
            }}
          >
            <span>
              Step {STEPS[mobileActiveStep].num} / 0{STEPS.length}
            </span>
            <span style={{ display: 'flex', gap: '4px' }} aria-hidden>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === mobileActiveStep ? '18px' : '5px',
                    height: '5px',
                    borderRadius: '999px',
                    background:
                      i <= mobileActiveStep
                        ? 'var(--c-lime)'
                        : 'rgba(17,17,17,0.18)',
                    transition:
                      'width 0.4s var(--ease-reveal), background 0.4s var(--ease-reveal)',
                  }}
                />
              ))}
            </span>
          </div>
        </div>

        {/* Step cards — each one is observed by the
            IntersectionObserver above; the active one gets the lime
            accent + full-color treatment while inactive cards fade
            to a muted state. */}
        <div
          style={{
            padding: '0 6vw 80px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {STEPS.map((step, i) => {
            const isActive = i === mobileActiveStep;
            return (
              <div
                key={step.num}
                ref={(el) => {
                  mobileCardRefs.current[i] = el;
                }}
                style={{
                  position: 'relative',
                  padding: '24px 20px 24px 24px',
                  borderRadius: '20px',
                  background: isActive
                    ? '#ffffff'
                    : 'rgba(255,255,255,0.62)',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'rgba(212, 224, 48, 0.55)'
                    : 'rgba(17,17,17,0.06)',
                  opacity: isActive ? 1 : 0.5,
                  filter: isActive ? 'none' : 'grayscale(0.5)',
                  transform: isActive ? 'scale(1)' : 'scale(0.97)',
                  transformOrigin: 'center',
                  transition:
                    'all 0.5s var(--ease-transition), border-color 0.5s var(--ease-reveal)',
                  boxShadow: isActive
                    ? '0 16px 40px rgba(17,17,17,0.08)'
                    : 'none',
                }}
              >
                {/* Lime accent bar on the left of the active card */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '24px',
                    bottom: '24px',
                    width: '3px',
                    background: 'var(--c-lime)',
                    borderRadius: '0 999px 999px 0',
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 0.4s var(--ease-reveal)',
                  }}
                />

                {/* Label row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: isActive
                        ? 'var(--c-lime)'
                        : 'rgba(17,17,17,0.06)',
                      color: isActive ? 'var(--c-dark-green)' : '#7f7f7f',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 700,
                      transition: 'all 0.4s var(--ease-reveal)',
                    }}
                  >
                    {step.num}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: '#7f7f7f',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {step.label}
                  </span>
                </div>

                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'clamp(22px, 6vw, 28px)',
                    fontWeight: 400,
                    lineHeight: 1.1,
                    color: '#111111',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.heading}
                </h3>
                <p
                  style={{
                    margin: '0 0 16px 0',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--c-dark-green)',
                    lineHeight: 1.35,
                  }}
                >
                  {step.tagline}
                </p>

                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    background: '#111111',
                    marginBottom: '14px',
                  }}
                >
                  <video
                    ref={(el) => {
                      mobileVideoRefs.current[i] = el;
                    }}
                    src={step.video}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>

                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {step.bullets.map((b, j) => (
                    <li
                      key={j}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontFamily: 'var(--font-primary)',
                        fontSize: '14px',
                        lineHeight: 1.5,
                        color: '#7f7f7f',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          flexShrink: 0,
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: 'var(--c-lime)',
                          marginTop: '7px',
                        }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
