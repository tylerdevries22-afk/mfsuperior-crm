'use client';

import { useEffect, useRef } from 'react';
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

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const overlayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Pause all videos — we drive currentTime from scroll.
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      v.pause();
      // Set initial state: first video visible, rest hidden.
      v.style.opacity = i === 0 ? '1' : '0';
    });
    // Heading colors are owned by CascadeText (scroll-linked per-letter
    // cascade). The legacy active/inactive JS color swap is removed
    // here — kept only for video opacity, overlay, and progress dot.
    overlayRefs.current.forEach((o, i) => {
      if (o) o.style.opacity = i === 0 ? '1' : '0';
    });
    dotRefs.current.forEach((d, i) => {
      if (d) d.style.backgroundColor = i === 0 ? '#D4E030' : 'rgba(255,255,255,0.3)';
    });

    let raf = 0;

    const tick = () => {
      const viewH = window.innerHeight;

      // Find the item whose center is closest to 40% from top (the "focus" row).
      let bestIndex = activeRef.current;
      let bestDist = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewH) return; // off-screen
        const center = (rect.top + rect.bottom) / 2;
        const dist = Math.abs(center - viewH * 0.4);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      });

      // Swap active item when it changes — pure DOM, no React state.
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

        // Update progress dots
        const pd = dotRefs.current[prev];
        if (pd) pd.style.backgroundColor = 'rgba(255,255,255,0.3)';
        const nd = dotRefs.current[bestIndex];
        if (nd) nd.style.backgroundColor = '#D4E030';

        activeRef.current = bestIndex;
      }

      // Scrub the active video frame-by-frame.
      // Progress: 0 when item center at 75% of viewport, 1 when center at 25%.
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

    // Gate the RAF loop on section visibility — saves CPU when off-screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          raf = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(section);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <section
      id="fleet"
      ref={sectionRef}
      style={{ width: '100%', backgroundColor: '#fff', paddingTop: '120px', scrollMarginTop: '80px' }}
    >
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
                  // CascadeText handles color animation via scroll position;
                  // we don't need the legacy JS color toggle below for h3.
                  color: '#111111',
                }}
              >
                <CascadeText
                  text={item.heading}
                  scrollLinked
                  // Wider scroll window so each item's cascade is clearly
                  // visible as it enters the focus row — items animate
                  // one after another as the user scrolls down.
                  spread={0.7}
                  offset={['start 95%', 'start 30%']}
                  finalColor="#111111"
                  flashColor="#D4E030"
                  // Very faint rest state so the "before / during / after"
                  // contrast of the cascade is unmistakable.
                  restColor="rgba(17,17,17,0.10)"
                />
              </h3>
            </div>
          ))}
        </div>

        {/* Right: sticky video stack — all 6 pre-rendered, only active visible */}
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
                  // Initial opacity controlled by JS after mount
                  opacity: 0,
                  transition: 'opacity 0.35s ease',
                  willChange: 'opacity',
                }}
              />
            ))}

            {/* Progress dots */}
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

            {/* Overlay badges — one per overlay item, CSS crossfaded */}
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
              ) : null
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
