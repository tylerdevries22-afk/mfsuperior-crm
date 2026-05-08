'use client';

import { useEffect, useRef } from 'react';
import { CascadeText } from './CascadeText';

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    // Keep paused — we drive currentTime from scroll.
    video.pause();

    let raf = 0;

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;

      // How far the user has scrolled into the section (px), clamped to [0, maxScroll].
      const scrolled = Math.max(0, -rect.top);
      const maxScroll = section.offsetHeight - viewH;
      const progress = maxScroll > 0 ? Math.min(1, scrolled / maxScroll) : 0;

      // Gradient → video crossfade (first ~30% of scroll range).
      const fade = Math.min(1, scrolled / 600);
      if (layerARef.current) layerARef.current.style.opacity = String(1 - fade);
      if (layerBRef.current) layerBRef.current.style.opacity = String(fade);

      // Scrub video frame-by-frame with scroll.
      if (video.readyState >= 2 && video.duration > 0) {
        video.currentTime = progress * video.duration;
      }

      raf = requestAnimationFrame(tick);
    };

    // Only run the loop while the section is visible.
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
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '200vh',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {/* Layer A: dark gradient — visible at top, fades out as user scrolls */}
      <div
        ref={layerARef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, #1c1c1c, #161616, #111111)',
          willChange: 'opacity',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* Layer B: video — fades in as user scrolls, scrubs frame-by-frame */}
      <div
        ref={layerBRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#0a0a0a',
          opacity: 0,
          willChange: 'opacity',
        }}
      >
        <video
          ref={videoRef}
          src="/videos/benefit-01-wide.mp4"
          muted
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 80%)',
          }}
        />
      </div>

      {/* Sticky text — stays in viewport for the full 200vh scroll */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '0 5.128vw 80px',
          }}
        >
          <p
            style={{
              fontSize: '16px',
              marginBottom: '8px',
              fontFamily: 'var(--font-primary)',
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            <CascadeText
              text="Colorado's most trusted freight delivery partner"
              scrollLinked
              spread={0.55}
              offset={['start 95%', 'start 55%']}
              finalColor="rgba(255,255,255,0.85)"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.10)"
            />
          </p>
          <h1
            style={{
              fontSize: 'clamp(48px, 6vw, 96px)',
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-primary)',
              margin: 0,
              color: '#fff',
            }}
          >
            <CascadeText
              text="Built for the work ahead."
              scrollLinked
              spread={0.6}
              offset={['start 90%', 'start 40%']}
              finalColor="#fff"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.18)"
            />
            <br />
            <CascadeText
              text="Delivery that doesn't quit."
              scrollLinked
              spread={0.6}
              offset={['start 80%', 'start 30%']}
              finalColor="#fff"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.18)"
            />
          </h1>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          }}
        >
          Scroll to Explore
        </div>
      </div>
    </section>
  );
}
