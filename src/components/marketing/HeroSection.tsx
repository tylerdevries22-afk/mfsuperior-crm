'use client';

import { useEffect, useRef } from 'react';
import { useScroll } from 'motion/react';
import { CascadeText } from './CascadeText';

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Shared scroll source for the hero — drives both the scroll-linked
  // cascade (per-line ranges below) and any future visual chained off
  // hero progress. Offset chosen so the cascade starts the moment the
  // section's top reaches viewport top and finishes well before the
  // section exits.
  const { scrollYProgress: heroProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

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
        // Scroll runway sized to the video's duration. The hero video
        // (benefit-01-vert.mp4) is 6.25s long; we map the scroll
        // progress to video.currentTime in the rAF tick, and we want
        // ~50vh of scroll per second of video for a deliberate
        // scrub-through feel.
        //
        //   visible frame (sticky)   100vh
        //   scrub runway   6.25s × 50vh ≈ 315vh
        //   total section            ≈ 420vh
        //
        // The section stays pinned for the entire 320vh of scroll
        // while the video plays through frame-by-frame. Only after
        // the user has scrubbed the full clip does the section
        // release and the next section come in.
        position: 'relative',
        minHeight: '420vh',
        // CRITICAL: do NOT set overflow: hidden here. When a sticky
        // descendant's nearest scrollable ancestor is the same element
        // it tries to pin against, sticky silently fails to engage —
        // the previous overflow: hidden was making the inner sticky
        // frame scroll AWAY with the page instead of pinning. We use
        // overflow-x: clip to still hide any horizontal bleed from the
        // 100vw video without creating a scroll/clip context that
        // breaks the sticky pin on the Y axis.
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
          {/*
            Headline cascades fire in the first ~40% of section scroll
            so they settle while there's still plenty of video left to
            scrub. The back 60% is pure video appreciation — both lines
            already revealed, user just scrolls through the truck
            reveal.

            Ranges against scrollYProgress (0–1) for the 420vh section:
               line 1 remainder → [0.04, 0.22]   ≈ scroll 17vh→92vh
               line 2 remainder → [0.25, 0.42]   ≈ scroll 105vh→176vh
               settled tail     → [0.42, 1.00]   ≈ scroll 176vh→420vh
                                                   (video keeps scrubbing)
          */}
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
            <span style={{ color: '#fff' }}>Built</span>{' '}
            <CascadeText
              text="for the work ahead."
              progress={heroProgress}
              range={[0.04, 0.22]}
              spread={1}
              finalColor="#fff"
              flashColor="#D4E030"
              restColor="rgba(255,255,255,0.18)"
            />
            <br />
            <span style={{ color: '#fff' }}>Delivery</span>{' '}
            <CascadeText
              text="that doesn't quit."
              progress={heroProgress}
              range={[0.25, 0.42]}
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
