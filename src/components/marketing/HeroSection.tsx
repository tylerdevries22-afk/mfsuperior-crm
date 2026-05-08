'use client';

import { useEffect, useRef } from 'react';
import { CascadeText } from './CascadeText';

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // The hero is the first thing the user sees — no scroll runway has
  // accumulated yet, so a scroll-linked cascade leaves the headline
  // mostly invisible on page load (rest state is faint by design). We
  // use the trigger / whileInView path of CascadeText with explicit
  // per-line delays instead, so the three lines reveal sequentially in
  // TIME (not scroll) within ~4 seconds of the hero entering view, then
  // sit settled for the rest of the section. Mid-page sections keep the
  // scroll-linked cascade — that's where the per-letter scroll reveal
  // feels right.

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
        // Scroll runway only — the cascades are time-driven now (play
        // on view) so this just gates how much scroll happens before
        // the next section enters and gives the rAF loop room to
        // scrub the gradient → video crossfade. 140vh = ~40vh of
        // scroll past the visible 100vh frame, enough for a
        // perceptible crossfade without dragging.
        position: 'relative',
        minHeight: '140vh',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {/*
        Single sticky frame holds EVERY visible hero element — the video,
        the gradient overlays, the headline, and the scroll cue. Pinning
        at 100vh max means the video element itself is never sized larger
        than the viewport on any device, so object-fit: cover never has
        to crop+upscale a 200vh-tall canvas (the previous bug that read
        as stretched/grainy).

        The section above is still 200vh — that height is the *scroll
        runway* that drives video.currentTime via the rAF loop. The two
        roles are now properly separated: section = scroll length;
        sticky frame = visual layout.
      */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          height: '100vh',
          // 100dvh on supporting browsers handles iOS Safari's URL bar
          // showing/hiding without making the hero re-resize and clip.
          maxHeight: '100dvh',
          overflow: 'hidden',
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
            src="/videos/benefit-01-vert.mp4"
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

        {/* Headline + scroll cue — pointer-events disabled on the wrapper
            so the user's scroll wheel/touch passes through to the section. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
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
              // Was a flat 16px — too small as a hero pre-title on
              // anything bigger than a phone. Scaled responsively now.
              fontSize: 'clamp(15px, 1.5vw, 22px)',
              marginBottom: '12px',
              fontFamily: 'var(--font-primary)',
              fontWeight: 400,
              lineHeight: 1.4,
              letterSpacing: '0.01em',
            }}
          >
            <CascadeText
              text="Colorado's most trusted freight delivery partner"
              scrollLinked={false}
              delay={0.25}
              stagger={0.022}
              duration={0.5}
              finalColor="rgba(255,255,255,0.85)"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.10)"
            />
          </p>
          <h1
            style={{
              fontSize: 'clamp(40px, 6vw, 96px)',
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
              scrollLinked={false}
              // Line 1 starts after the pretitle finishes
              // (~0.25 + 0.022 × 47chars + 0.5 ≈ 1.78s).
              delay={1.85}
              stagger={0.028}
              duration={0.55}
              finalColor="#fff"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.18)"
            />
            <br />
            <CascadeText
              text="Delivery that doesn't quit."
              scrollLinked={false}
              // Line 2 starts after line 1 finishes
              // (1.85 + 0.028 × 25chars + 0.55 ≈ 3.10s).
              delay={3.15}
              stagger={0.028}
              duration={0.55}
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
      </div>
    </section>
  );
}
