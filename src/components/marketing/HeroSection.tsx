'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue } from 'motion/react';
import { CascadeText } from './CascadeText';

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hero progress as a MotionValue driven directly off the rAF loop
  // below. We DELIBERATELY DO NOT use framer-motion's `useScroll` here:
  // when Lenis smooth-scrolls the page, framer-motion's scroll source
  // can fall out of sync (heroProgress was empirically capping at ~0.23
  // even when the user had scrolled to the bottom of the 420vh hero).
  // The rAF tick reads `getBoundingClientRect()` which is always
  // accurate regardless of who's driving the scroll, so it gives us a
  // clean 0→1 progress that the cascade can map against.
  const heroProgress = useMotionValue(0);

  // Animation choice (per user direction):
  //   • Hero text is SCROLL-DRIVEN, not time-based. Each line's cascade
  //     ranges are non-overlapping (sequential reveal as you scroll).
  //   • The FIRST WORD of each line is rendered as plain final-color
  //     text — always visible at scroll=0 so the user lands on
  //     "Colorado's / Built / Delivery" without needing to interact.
  //   • The video is visible from page load and stays sticky-pinned at
  //     100vh while the user scrolls (scroll-scrubs via rAF). The
  //     gradient-A → video crossfade was removed so the video's role
  //     as the hero backdrop is unambiguous from the first frame.

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

      // Push to the shared MotionValue that the CascadeText chains off.
      heroProgress.set(progress);

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
  }, [heroProgress]);

  return (
    <section
      ref={sectionRef}
      className="mkt-hero-runway"
      style={{
        // Scroll runway height lives in CSS (.mkt-hero-runway in
        // globals.css) so we can tune per breakpoint: 420vh desktop,
        // 300vh tablet, 260vh phone. The cascade range [0.04, 0.96]
        // is *proportional* to section height, so it stays in lockstep
        // with video.currentTime across breakpoints — no per-device
        // range math needed.
        position: 'relative',
        // CRITICAL: do NOT set overflow: hidden here. When a sticky
        // descendant's nearest scrollable ancestor is the same element
        // it tries to pin against, sticky silently fails to engage.
        // overflow-x: clip hides horizontal bleed from the 100vw video
        // without creating a scroll/clip context that breaks the sticky
        // pin on the Y axis.
        overflowX: 'clip',
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
        {/* Video backdrop — visible from page load (no crossfade). The
            sticky frame above keeps it pinned at 100vh while the user
            scrolls; the rAF loop scrubs video.currentTime against
            scroll progress so the truck wireframe animates as you go.

            The dark bottom-up gradient on top of the video gives the
            headline the contrast it needs to stay readable against a
            potentially bright/busy frame. No animated opacity. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#0a0a0a',
          }}
        >
          <video
            ref={videoRef}
            src="/videos/benefit-01-vert.mp4"
            poster="/videos/benefit-01-vert.jpg"
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
                'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.15) 75%, transparent 100%)',
            }}
          />
        </div>

        {/* Headline + scroll cue — pointer-events disabled on the
            wrapper so the user's scroll wheel/touch passes through to
            the section. Vertically centered (was bottom-aligned with
            80px footer pad) so the headline sits in the visible middle
            of the hero, not jammed to the floor where it competes with
            the scroll-cue and section-end gradient. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
        <div
          style={{
            padding: '0 5.128vw',
          }}
        >
          {/*
            Headline cascade is now SYNCED with the video scrub:
            both span the full scroll runway from start to end. As
            the video plays through (currentTime = progress × duration),
            the headline letters reveal letter-by-letter at the same
            pace. They finish together at the bottom of the section.

            Ranges against scrollYProgress (0–1) for the 420vh section:
               cascade  → [0.04, 0.96]   spans full scroll
               video    → [0.00, 1.00]   spans full scroll
            Both arrive at "settled" state at the same time.
          */}
          <h1
            style={{
              // Tighter responsive clamp: floor 32px so the headline
              // wraps cleanly to 2 lines max on 375px phones; 7vw
              // gives a gentler grow-rate than the old 6vw so cascade
              // per-letter timing stays proportional to the line
              // widths the reader actually sees.
              fontSize: 'clamp(32px, 7vw, 96px)',
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-primary)',
              margin: 0,
              color: '#fff',
            }}
          >
            {/*
              Single-line hero: "We haul what others won't touch."
              "We" stays visible at scroll=0 (always-on first word); the
              rest cascades in letter-by-letter, paced to span the same
              scroll range as the video scrub so both animations finish
              together at the bottom of the 420vh runway.
            */}
            <span style={{ color: '#fff' }}>We</span>{' '}
            <CascadeText
              text="haul what others won't touch."
              progress={heroProgress}
              // Span the full scroll runway so the headline keeps
              // revealing as the video keeps scrubbing — synced from
              // start to finish. Letters trickle in one at a time across
              // the entire ~320vh of scroll (≈3 viewport heights).
              range={[0.04, 0.96]}
              spread={1}
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
