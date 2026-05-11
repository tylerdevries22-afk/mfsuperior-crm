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

    // ── Hyper-responsive scroll-scrub (v4) ───────────────────────
    //
    // Iteration history matters here — every prior attempt got
    // closer but missed a real-world failure mode:
    //
    //   v1: rAF every frame, currentTime= every tick. Streaming-
    //       profile MP4 made seeks fall hundreds of ms behind.
    //   v2: scroll-event driven. Lenis smooth-scroll emits only a
    //       few native scroll events per gesture, so the video
    //       stranded mid-runway.
    //   v3: continuous rAF + scroll + Lenis listener. Correct
    //       timing but seeks still stalled when the byte range
    //       wasn't buffered yet (7.6 MB MP4 at 1080p).
    //   v4 (here): all of the above PLUS
    //       • the MP4 itself is now 2.2 MB at 540×960 (half-res,
    //         CRF 26, all-keyframe). Fits in a single TCP slow-
    //         start window and finishes buffering before the
    //         user can scroll past the first 10% of the runway.
    //       • on mount we call `video.load()` + a play/pause
    //         prime so the browser eagerly downloads + decodes
    //         the full byte range, NOT just the metadata.
    //       • stuck-seek recovery: if `video.seeking` stays true
    //         for > 200ms (seek-past-buffered case), we drop the
    //         bail and re-issue, which supersedes the stuck one.
    //       • `window.__heroScrubDebug` exposes live values so the
    //         operator can verify the loop is firing from DevTools.

    const FRAME_DT = 1 / 24;
    const SEEK_STUCK_MS = 200;

    // Force-decode prime. `preload="auto"` is a hint; some browsers
    // (esp. Safari + Chrome on slow connections) downgrade it to
    // metadata-only. Calling load() + a brief play() forces the
    // browser to fetch + decode the entire byte range eagerly.
    // play() on a muted video is allowed without a user gesture
    // per autoplay policy; we wrap in try/catch in case a browser
    // is stricter than spec.
    video.muted = true;
    video.load();
    void video.play().then(() => video.pause()).catch(() => {
      // play() rejected (rare on muted video). Not fatal — the
      // rAF loop below still drives currentTime; the browser will
      // buffer on demand. Diagnostic only.
      // eslint-disable-next-line no-console
      console.warn("[hero-scrub] play() prime rejected; proceeding with on-demand buffer.");
    });

    video.style.willChange = "transform";

    let rafId = 0;
    let lastAppliedTime = -1;
    let lastSeekAt = 0;
    let tickCount = 0;

    const applySeek = (targetTime: number) => {
      const now = performance.now();
      // Stuck-seek recovery: if seeking has been pending too long
      // it almost certainly means the byte range isn't buffered.
      // Re-issuing lets the browser cancel + retry.
      const stuck = video.seeking && now - lastSeekAt > SEEK_STUCK_MS;
      if (video.seeking && !stuck) return;
      // Duration must be known. readyState check intentionally
      // relaxed (v3 bailed on < 2 → was the cause of "video not
      // animating" on slow connections). Seeking to an unbuffered
      // frame triggers buffering; the next rAF will retry.
      if (!(video.duration > 0)) return;

      const snapped = Math.round(targetTime / FRAME_DT) * FRAME_DT;
      const last = Math.max(0, video.duration - FRAME_DT);
      const clamped = Math.min(snapped, last);
      if (Math.abs(clamped - lastAppliedTime) < FRAME_DT / 2 && !stuck) return;
      try {
        video.currentTime = clamped;
        lastAppliedTime = clamped;
        lastSeekAt = now;
      } catch {
        // Setting currentTime on a not-yet-loaded video can throw
        // on some browsers. Silent — next rAF will retry.
      }
    };

    const recompute = () => {
      tickCount += 1;
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const maxScroll = section.offsetHeight - viewH;
      const sectionProgress =
        maxScroll > 0 ? Math.min(1, scrolled / maxScroll) : 0;

      // Map both animations into a sub-range of section progress
      // so the scrub completes BEFORE the next section reveals.
      const ANIM_END = 0.85;
      const animProgress = Math.min(1, sectionProgress / ANIM_END);

      heroProgress.set(animProgress);

      if (video.duration > 0) {
        applySeek(animProgress * video.duration);
      }

      // Live debug surface — inspect in DevTools console:
      //   __heroScrubDebug
      // Lets the operator verify on real hardware that the loop
      // is firing, the section dimensions are sane, and the
      // video is actually buffering. Cheap (one object write).
      (window as unknown as { __heroScrubDebug?: object }).__heroScrubDebug = {
        ticks: tickCount,
        sectionH: section.offsetHeight,
        viewH,
        maxScroll,
        scrolled,
        sectionProgress,
        animProgress,
        videoDuration: video.duration,
        videoCurrent: video.currentTime,
        videoReadyState: video.readyState,
        videoSeeking: video.seeking,
        lastAppliedTime,
      };
    };

    const tick = () => {
      recompute();
      rafId = requestAnimationFrame(tick);
    };

    const onScroll = () => recompute();
    const onResize = () => recompute();
    const onLoadedMeta = () => recompute();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("loadeddata", onLoadedMeta);

    const lenis = (
      window as unknown as {
        __mfsLenis?: {
          on: (e: string, cb: () => void) => void;
          off: (e: string, cb: () => void) => void;
        };
      }
    ).__mfsLenis;
    if (lenis?.on) lenis.on("scroll", recompute);

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("loadeddata", onLoadedMeta);
      if (lenis?.off) lenis.off("scroll", recompute);
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

            Both animations share the same mapped progress curve:
            section scroll progress 0 → 0.85 drives both video AND
            cascade from 0 → 1 in lockstep. Section progress 0.85
            → 1.0 is the "settled hero" buffer — video sits on
            frame 149 and the headline holds in final white while
            the user finishes scrolling past the runway. This
            ensures the entire scrub is visible BEFORE the next
            section enters the viewport from below.
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
