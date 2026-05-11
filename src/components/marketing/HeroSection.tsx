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
  // even when the user had scrolled to the bottom of the runway).
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
    // Two coupled fixes:
    //
    // 1. The source MP4 (`benefit-01-vert-scrub.mp4`) is re-encoded
    //    `-g 1 -bf 0` — every frame is a keyframe, so seeking to any
    //    timestamp decodes a single frame instead of walking from
    //    the previous keyframe forward. File grew 2.4 MB → 7.6 MB;
    //    acceptable for the single hero asset. (The non-scrub MP4
    //    is still served on the linear-playback benefit sections
    //    where seek cost doesn't matter.)
    //
    // 2. The scrub loop, below. Iteration history matters here:
    //
    //    v1 (pre-#42): rAF every frame → `currentTime = …` every
    //      tick. With the streaming-profile MP4 this fell hundreds
    //      of ms behind on fast scrolls.
    //
    //    v2 (#42): replaced rAF with passive `scroll` listener +
    //      single-rAF coalescer. Faster on plain pages, but the
    //      marketing page wraps the body in `<LenisProvider>` which
    //      smooth-scrolls via its own internal rAF and only emits
    //      a handful of native `scroll` events per gesture (start,
    //      mid, end). The eased frames in between never triggered a
    //      recompute, so a full-runway flick stranded the video at
    //      ~0.6 progress. That was the bug the operator hit.
    //
    //    v3 (here): back to a continuous rAF driver (matches Lenis's
    //      own frame loop) — but every concern from v2 still
    //      applies, so each tick reuses the same gates:
    //         • frame-snap to 1/24s (dedup sub-frame targets)
    //         • skip if video.seeking (don't queue seeks)
    //         • skip if displayed frame index is unchanged
    //      Plus, recompute also still fires on scroll + resize so we
    //      catch instant jumps (anchor links, programmatic scrollTo)
    //      that out-pace rAF.

    // Frame interval (s) for the 24fps source. Used as the seek
    // deadband so we don't issue redundant seeks.
    const FRAME_DT = 1 / 24;

    video.pause();
    // Compositor hint — encourages browsers to keep the video element
    // on its own GPU layer so frame swaps don't repaint the headline
    // and overlays each tick.
    video.style.willChange = "transform";

    let rafId = 0;
    let lastAppliedTime = -1;

    const applySeek = (targetTime: number) => {
      // Bail if the previous seek hasn't painted yet — queuing seeks
      // is the #1 cause of scrub lag.
      if (video.seeking) return;
      if (!(video.readyState >= 2) || !(video.duration > 0)) return;

      // Frame-snap so two scrolls producing the same visible frame
      // collapse to a single (skipped) seek.
      const snapped = Math.round(targetTime / FRAME_DT) * FRAME_DT;
      // Clamp to the last decodable frame's timestamp. Setting
      // currentTime === duration triggers the "ended" state on some
      // browsers (which can flash the poster). One frame back is
      // visually identical and safer.
      const last = Math.max(0, video.duration - FRAME_DT);
      const clamped = Math.min(snapped, last);
      if (Math.abs(clamped - lastAppliedTime) < FRAME_DT / 2) return;
      video.currentTime = clamped;
      lastAppliedTime = clamped;
    };

    const recompute = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const maxScroll = section.offsetHeight - viewH;
      const progress = maxScroll > 0 ? Math.min(1, scrolled / maxScroll) : 0;

      // CascadeText reads this MotionValue every render — keep it
      // current even before the video is seekable.
      heroProgress.set(progress);

      if (video.duration > 0) {
        applySeek(progress * video.duration);
      }
    };

    // Continuous rAF — matches Lenis's own frame budget and ensures
    // the video tracks the smooth-scroll easing curve, not just the
    // discrete native `scroll` events Lenis ends up emitting. The
    // per-frame work is bounded: ≤1 cheap `getBoundingClientRect`
    // call + at most one frame-snapped `currentTime=` assignment.
    const tick = () => {
      recompute();
      rafId = requestAnimationFrame(tick);
    };

    // Belt + suspenders: also recompute on instant scroll jumps
    // (anchor links, scrollTo from the nav, resize). These can land
    // a new scroll position between rAF frames; firing recompute on
    // the event itself catches that without waiting one frame.
    const onScroll = () => recompute();
    const onResize = () => recompute();

    // Once the video metadata is ready, do an immediate recompute so
    // a reload mid-scroll lands on the correct frame.
    const onLoadedMeta = () => recompute();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("loadeddata", onLoadedMeta);

    // If Lenis is mounted, hook its smoothed scroll event too. Lenis
    // emits this on every eased frame during animation — even when
    // the native window `scroll` event would have already fired and
    // the next rAF hasn't ticked yet — so this closes the smallest
    // remaining sync window between user input and frame paint.
    const lenis = (window as unknown as { __mfsLenis?: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void } }).__mfsLenis;
    if (lenis?.on) {
      lenis.on("scroll", recompute);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("loadeddata", onLoadedMeta);
      if (lenis?.off) {
        lenis.off("scroll", recompute);
      }
    };
  }, [heroProgress]);

  return (
    <section
      ref={sectionRef}
      className="mkt-hero-runway"
      style={{
        // Scroll runway height lives in CSS (.mkt-hero-runway in
        // globals.css) so we can tune per breakpoint: 280vh desktop,
        // 240vh tablet, 220vh phone. Both the video scrub and the
        // cascade text use range [0, 1] of section progress, so they
        // stay in lockstep across every breakpoint with no per-device
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

            Both animations use range [0, 1] of section scroll
            progress:
               cascade  → [0, 1]   spans full scroll
               video    → [0, 1]   spans full scroll
            They reach their settled state on the exact same frame
            at the bottom of the runway.
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
              together at the bottom of the runway.
            */}
            <span style={{ color: '#fff' }}>We</span>{' '}
            <CascadeText
              text="haul what others won't touch."
              progress={heroProgress}
              // Sync the cascade 1:1 with the video scrub: both
              // animations span the FULL [0, 1] of scroll progress,
              // so the last letter snaps into place on the exact
              // same frame the video reaches frame 149. The prior
              // [0.04, 0.96] window meant the cascade was 4% ahead
              // at the start and 4% behind at the end — visible as
              // the text "finishing early" while the video was
              // still scrubbing the last frames.
              range={[0, 1]}
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
