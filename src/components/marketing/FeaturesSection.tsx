'use client';

import { useEffect, useRef, useState } from 'react';
import { CascadeText } from './CascadeText';

interface FeatureItem {
  num: string;
  heading: string;
  video: string;
  overlay: string | null;
}

const items: FeatureItem[] = [
  { num: '01', heading: '16ft to 26ft capacity — the right truck for any freight load', video: '/videos/features-01.mp4', overlay: null },
  { num: '02', heading: 'Same-day and next-day dispatch across the Denver metro area', video: '/videos/features-03.mp4', overlay: 'ON TIME ✓' },
  { num: '03', heading: 'Fast scheduling with same-week dispatch — no delays, no runaround', video: '/videos/features-02.mp4', overlay: 'SCHEDULED ✓' },
  { num: '04', heading: 'Every run handled by professional, insured, experienced drivers', video: '/videos/features-04.mp4', overlay: null },
  { num: '05', heading: 'Liftgate service, GPS tracking, and temperature-sensitive freight options', video: '/videos/features-05.mp4', overlay: null },
  { num: '06', heading: 'White-glove delivery and dedicated support across all of Colorado', video: '/videos/features-06.mp4', overlay: 'DELIVERED ✓' },
];

/**
 * Two layouts in one section, switched by CSS media query in
 * globals.css:
 *
 *   Desktop (≥768px) — `.mkt-features-grid` is the existing
 *     two-column scroll-driven layout. Left column is a stack of
 *     all 6 items the user reads through; right column is a sticky
 *     video panel that swaps the active video as the user scrolls.
 *
 *   Mobile (<768px) — `.mkt-features-mobile-carousel` is the new
 *     terminal-industries-style vertical carousel. Big video panel
 *     on top, then ◂ ▸ arrow nav + 01–06 pagination + the active
 *     item's heading. Click-driven, no scroll-jacking.
 *
 * The two share the same items[] data and the same #fleet section
 * id so the navbar scroll-spy still works.
 */
export function FeaturesSection() {
  return (
    <section
      id="fleet"
      style={{ width: '100%', backgroundColor: '#fff', paddingTop: '120px', scrollMarginTop: '80px' }}
    >
      <DesktopLayout />
      <MobileCarousel />
    </section>
  );
}

/* ─── Desktop: original two-column scroll-driven layout ─────────── */

function DesktopLayout() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const overlayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      v.pause();
      v.style.opacity = i === 0 ? '1' : '0';
    });
    overlayRefs.current.forEach((o, i) => {
      if (o) o.style.opacity = i === 0 ? '1' : '0';
    });
    dotRefs.current.forEach((d, i) => {
      if (d) d.style.backgroundColor = i === 0 ? '#D4E030' : 'rgba(255,255,255,0.3)';
    });

    let raf = 0;

    const tick = () => {
      const viewH = window.innerHeight;
      let bestIndex = activeRef.current;
      let bestDist = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewH) return;
        const center = (rect.top + rect.bottom) / 2;
        const dist = Math.abs(center - viewH * 0.4);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      });

      if (bestIndex !== activeRef.current) {
        const prev = activeRef.current;
        const pv = videoRefs.current[prev];
        if (pv) { pv.style.opacity = '0'; pv.pause(); }
        const po = overlayRefs.current[prev];
        if (po) po.style.opacity = '0';
        const nv = videoRefs.current[bestIndex];
        if (nv) { nv.style.opacity = '1'; nv.pause(); }
        const no = overlayRefs.current[bestIndex];
        if (no) no.style.opacity = '1';
        const pd = dotRefs.current[prev];
        if (pd) pd.style.backgroundColor = 'rgba(255,255,255,0.3)';
        const nd = dotRefs.current[bestIndex];
        if (nd) nd.style.backgroundColor = '#D4E030';
        activeRef.current = bestIndex;
      }

      const activeEl = itemRefs.current[bestIndex];
      const activeVideo = videoRefs.current[bestIndex];
      if (activeEl && activeVideo && activeVideo.readyState >= 2 && activeVideo.duration > 0) {
        const rect = activeEl.getBoundingClientRect();
        const center = (rect.top + rect.bottom) / 2;
        const progress = 1 - (center - viewH * 0.25) / (viewH * 0.5);
        activeVideo.currentTime = Math.max(0, Math.min(1, progress)) * activeVideo.duration;
      }

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
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  return (
    <div ref={sectionRef} className="mkt-features-desktop">
      {/* Section heading */}
      <div style={{ textAlign: 'center', paddingLeft: '5.128vw', paddingRight: '5.128vw' }}>
        <p
          style={{
            fontSize: '20px',
            color: '#111111',
            fontFamily: 'var(--font-primary)',
            fontWeight: 400,
            lineHeight: 1.4,
            marginBottom: '24px',
          }}
        >
          Reliable freight delivery built for Colorado&apos;s toughest routes.
        </p>
        <h2
          style={{
            fontSize: 'clamp(32px, 4vw, 56px)',
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-primary)',
            maxWidth: '900px',
            margin: '0 auto 80px',
            color: '#111111',
          }}
        >
          <CascadeText
            text="Imagine a delivery partner that works as hard as you do — from pickup to final mile."
            stagger={0.018}
            duration={0.5}
            finalColor="#111111"
            flashColor="#D4E030"
            restColor="rgba(17,17,17,0.18)"
          />
        </h2>
      </div>

      {/* Two-column layout */}
      <div
        className="mkt-features-grid"
        style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}
      >
        {/* Left: scrollable item list */}
        <div className="mkt-features-left" style={{ width: '42%', flexShrink: 0 }}>
          {items.map((item, index) => (
            <div
              key={item.num}
              ref={(el) => { itemRefs.current[index] = el; }}
              className="mkt-features-item"
              style={{ padding: '80px 5.128vw 80px 5.128vw', minHeight: '280px' }}
            >
              <p
                style={{
                  fontSize: '11px',
                  color: '#7f7f7f',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  marginBottom: '16px',
                  fontWeight: 400,
                }}
              >
                {item.num}
              </p>
              <h3
                ref={(el) => { headingRefs.current[index] = el; }}
                style={{
                  fontSize: 'clamp(24px, 2.5vw, 38px)',
                  fontWeight: 400,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-primary)',
                  margin: 0,
                  color: '#111111',
                }}
              >
                <CascadeText
                  text={item.heading}
                  scrollLinked
                  spread={0.7}
                  offset={['start 95%', 'start 30%']}
                  finalColor="#111111"
                  flashColor="#D4E030"
                  restColor="rgba(17,17,17,0.10)"
                />
              </h3>
            </div>
          ))}
        </div>

        {/* Right: sticky video stack */}
        <div
          className="mkt-features-right"
          style={{
            width: '58%',
            flexShrink: 0,
            position: 'sticky',
            top: '80px',
            height: 'calc(100vh - 100px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
              borderRadius: '24px 0 0 0',
              overflow: 'hidden',
            }}
          >
            {items.map((item, index) => (
              <video
                key={item.video}
                ref={(el) => { videoRefs.current[index] = el; }}
                src={item.video}
                muted
                playsInline
                preload="auto"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  opacity: 0,
                  transition: 'opacity 0.35s ease',
                  willChange: 'opacity',
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              {items.map((_, i) => (
                <div
                  key={i}
                  ref={(el) => { dotRefs.current[i] = el; }}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: i === 0 ? '#D4E030' : 'rgba(255,255,255,0.3)',
                    transition: 'background-color 0.35s ease',
                  }}
                />
              ))}
            </div>
            {items.map((item, index) =>
              item.overlay ? (
                <div
                  key={item.overlay}
                  ref={(el) => { overlayRefs.current[index] = el; }}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#D4E030',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    letterSpacing: '0.15em',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    opacity: 0,
                    transition: 'opacity 0.35s ease',
                    willChange: 'opacity',
                    pointerEvents: 'none',
                  }}
                >
                  {item.overlay}
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Mobile: vertical carousel (terminal-industries layout) ───── */

function MobileCarousel() {
  const [active, setActive] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [active]);

  const next = () => setActive((i) => (i + 1) % items.length);
  const prev = () => setActive((i) => (i - 1 + items.length) % items.length);

  return (
    <div
      className="mkt-features-mobile-carousel"
      style={{
        // Hidden by default; CSS in globals.css flips this on at <768px.
        display: 'none',
        background: '#0a0a0a',
        borderTopLeftRadius: '32px',
        borderTopRightRadius: '32px',
        margin: '40px -5.128vw 0',
        padding: '64px 5.128vw 80px',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
          fontWeight: 400,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginBottom: '16px',
        }}
      >
        Fleet Capabilities
      </p>
      <h2
        style={{
          fontSize: 'clamp(22px, 6vw, 36px)',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          fontFamily: 'var(--font-primary)',
          textAlign: 'center',
          margin: '0 auto 32px',
          color: '#fff',
        }}
      >
        <CascadeText
          text="Imagine a delivery partner that works as hard as you do."
          scrollLinked
          spread={0.6}
          offset={['start 90%', 'start 35%']}
          finalColor="#fff"
          flashColor="#D4E030"
          restColor="rgba(255,255,255,0.16)"
        />
      </h2>

      {/* Video panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#111',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {items.map((item, i) => (
          <video
            key={item.num}
            ref={(el) => { videoRefs.current[i] = el; }}
            src={item.video}
            muted
            playsInline
            loop
            preload="auto"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: i === active ? 1 : 0,
              transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        ))}
        {items[active].overlay && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '6px 10px',
              background: 'rgba(212,224,48,0.92)',
              color: '#0a0a0a',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              borderRadius: '4px',
            }}
          >
            {items[active].overlay}
          </div>
        )}
      </div>

      {/* Pagination row */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          letterSpacing: '0.08em',
          marginTop: '24px',
          flexWrap: 'wrap',
        }}
      >
        {items.map((item, i) => (
          <button
            key={item.num}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`View feature ${item.num}`}
            aria-current={i === active ? 'true' : undefined}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
              color: i === active ? '#D4E030' : 'rgba(255,255,255,0.4)',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              fontWeight: i === active ? 600 : 400,
              transition: 'color 0.25s',
            }}
          >
            {item.num}
          </button>
        ))}
      </div>

      {/* Active heading */}
      <h3
        key={items[active].heading}
        style={{
          fontSize: 'clamp(18px, 5vw, 24px)',
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          fontFamily: 'var(--font-primary)',
          margin: '20px 0 32px',
          color: '#fff',
          textAlign: 'center',
          minHeight: '3.6em',
        }}
      >
        <CascadeText
          text={items[active].heading}
          scrollLinked={false}
          stagger={0.022}
          duration={0.45}
          delay={0.05}
          finalColor="#fff"
          flashColor="#D4E030"
          restColor="rgba(255,255,255,0.18)"
        />
      </h3>

      {/* Arrow nav */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={prev}
          aria-label="Previous feature"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next feature"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '999px',
            border: 'none',
            background: '#D4E030',
            color: '#0a0a0a',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
