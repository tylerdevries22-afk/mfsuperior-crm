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

    // ── Hyper-responsive scroll-scrub ────────────────────────────
    //
    // The prior implementation called `video.currentTime = progress *
    // duration` on every rAF tick. With a normally-encoded H.264 MP4
    // (one keyframe + 149 inter-frames) every seek had to decode from
    // the previous keyframe forward, so fast scrolls fell hundreds of
    // milliseconds behind the wheel. The video looked like it was
    // playing in slow motion catching up to the scroll position.
    //
    // Two changes make this feel instant:
    //
    // 1. The video file itself: `benefit-01-vert-scrub.mp4` is encoded
    //    with `-g 1 -bf 0` (every frame is a keyframe, no B-frames),
    //    so a seek to any time is decode-one-frame fast — no
    //    dependency chain. File grew from 2.4 MB → 7.6 MB; for a
    //    hero asset that's an acceptable trade.
    //
    // 2. The scrub loop:
    //    • Scroll-event driven (passive) + a single rAF coalescer so
    //      we run exactly one seek per animation frame, regardless of
    //      how many scroll events fire.
    //    • Frame-snapped: round target time to the nearest frame at
    //      24fps. Sub-frame seeks repaint the same pixels — pure
    //      waste — so we filter them out.
    //    • Seek-while-seeking dropped: `video.seeking === true` means
    //      the previous seek hasn't painted yet. Skipping the new
    //      assignment lets the pipeline catch up instead of queuing.
    //    • `requestVideoFrameCallback` (when available) gives us a
    //      true frame-painted signal so consecutive seeks pace
    //      themselves against actual decoded frames, not against
    //      rAF (which fires faster than video decode on heavy
    //      scrolls).

    // Frame interval (s) for the 24fps source. Used as the seek
    // deadband so we don't issue redundant seeks.
    const FRAME_DT = 1 / 24;

    video.pause();
    // Compositor hint — encourages browsers to keep the video element
    // on its own GPU layer so canvas-style scrubbing doesn't trigger
    // layout/paint upstream.
    video.style.willChange = "transform";

    let rafId = 0;
    let targetTime = 0;
    let lastAppliedTime = -1;
    let pending = false;

    const applySeek = () => {
      pending = false;
      // Bail if the previous seek hasn't painted yet — queuing seeks
      // is the #1 cause of scrub lag.
      if (video.seeking) {
        // Re-arm so we pick up the next animation frame.
        schedule();
        return;
      }
      // Frame-snap so two scrolls producing the same visible frame
      // collapse to a single (skipped) seek.
      const snapped = Math.round(targetTime / FRAME_DT) * FRAME_DT;
      if (Math.abs(snapped - lastAppliedTime) < FRAME_DT / 2) return;
      if (video.readyState >= 2 && video.duration > 0) {
        // Clamp to avoid seeking past the last decodable frame.
        const clamped = Math.min(snapped, video.duration - FRAME_DT);
        video.currentTime = clamped;
        lastAppliedTime = clamped;
      }
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(applySeek);
    };

    const recompute = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const maxScroll = section.offsetHeight - viewH;
      const progress = maxScroll > 0 ? Math.min(1, scrolled / maxScroll) : 0;

      // CascadeText reads this MotionValue every render — keep it
      // updated even when we're not seeking the video (e.g., during
      // scroll-up past the section top before the runway begins).
      heroProgress.set(progress);

      if (video.duration > 0) {
        targetTime = progress * video.duration;
        schedule();
      }
    };

    // Drive recompute from real scroll events (passive so we don't
    // block the main thread) plus a one-shot initial call so the
    // hero lands at the correct frame on page reload mid-scroll.
    const onScroll = () => recompute();
    const onResize = () => recompute();

    // Once the video has enough data to seek, fire an initial
    // recompute so the first frame matches the current scroll
    // position without waiting for the user to move.
    const onLoadedMeta = () => recompute();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("loadeddata", onLoadedMeta);

    recompute();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("loadeddata", onLoadedMeta);
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
            // `-scrub.mp4` is re-encoded with `-g 1 -bf 0` so every
            // frame is a keyframe — seeks are decode-one-frame fast
            // (vs. decode-from-prior-keyframe for the streaming
            // variant). The non-scrub MP4 is still served on the
            // benefit sections where playback is linear and seek
            // cost doesn't matter.
            src="/videos/benefit-01-vert-scrub.mp4"
            poster="/videos/benefit-01-vert.jpg"
            muted
            playsInline
            preload="auto"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              // GPU compositor hint: keeps the video on its own
              // layer so frame-by-frame seeking doesn't repaint the
              // headline / overlays each tick.
              transform: 'translateZ(0)',
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
