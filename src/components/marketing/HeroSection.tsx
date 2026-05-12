'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue } from 'motion/react';
import { CascadeText } from './CascadeText';

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Wraps the headline + scroll-cue. The rAF loop writes
  // `style.opacity` directly so we don't pay React-re-render
  // cost per scroll frame. Synced with TypewriterSection's
  // fade-in so they swap together as the white panel arrives.
  const headlineRef = useRef<HTMLDivElement>(null);

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

      // Headline opacity fade-out, synced with the white panel's
      // arrival. The TypewriterSection has marginTop: -100vh, so
      // its top edge arrives at viewport top at sectionProgress
      // = 1.0 (scrolled = maxScroll). Fading the headline out
      // between 0.7 and 1.0 means it's gone by the time the
      // panel fully covers — and the typewriter cascade
      // (controlled by its own scroll progress) is fading in
      // over the same scroll window, so the two text states
      // visually trade off.
      if (headlineRef.current) {
        const FADE_START = 0.7;
        const FADE_END = 1.0;
        const t =
          (sectionProgress - FADE_START) / (FADE_END - FADE_START);
        const opacity = Math.max(0, Math.min(1, 1 - t));
        headlineRef.current.style.opacity = String(opacity);
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
    // Stacked-stage architecture:
    //   • <section> is the SCROLL RUNWAY — invisible, just gives
    //     the page enough scrollable height to drive the video
    //     scrub. References itself via `sectionRef` so the rAF
    //     loop above can read its bounding rect.
    //   • The visible hero is a SIBLING `<div>` with
    //     `position: fixed` so it stays bolted to the viewport
    //     while the user scrolls. The TypewriterSection that
    //     follows in the page has `marginTop: -100vh` + a
    //     higher z-index, so it scrolls UP over this fixed
    //     stage — which is the operator's requested effect:
    //     the white panel "slides in on top of the hero
    //     scrub video."
    //
    // Why the stage isn't simply `position: sticky` like the
    // prior iteration: sticky releases when its parent's
    // bottom passes viewport top, which would let the hero
    // scroll off-screen before the typewriter has fully
    // covered it. `fixed` stays put indefinitely; the
    // overlapping typewriter section visually "hides" it
    // once the user has scrolled past the runway.
    <>
      <div
        // The visible hero stage. `position: fixed` keeps it
        // pinned to the viewport for the entire scroll life
        // of the page. The TypewriterSection sits at z-index
        // 10+ in the page tree so it scrolls UP over this
        // stage — synchronized fade-out below makes the
        // hero text dissolve as that white panel arrives.
        style={{
          position: 'fixed',
          inset: 0,
          // 100dvh on supporting browsers handles iOS Safari's URL
          // bar showing/hiding without making the hero re-resize.
          maxHeight: '100dvh',
          overflow: 'hidden',
          zIndex: 0,
          backgroundColor: '#000',
        }}
      >
        {/* Video backdrop. rAF loop above scrubs currentTime
            against scroll progress so the truck wireframe
            animates as the user goes. Dark bottom-up gradient
            preserves headline contrast. */}
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
            // frame is a keyframe — seeks are decode-one-frame fast.
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

        {/* Headline + scroll cue. `ref={headlineRef}` is used by
            the rAF loop to write `style.opacity` directly,
            synced with the TypewriterSection's fade-in so the
            two transitions visually swap as the white panel
            scrolls in. pointer-events: none so the user's wheel
            passes through. */}
        <div
          ref={headlineRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            pointerEvents: 'none',
            willChange: 'opacity',
          }}
        >
          <div
            style={{
              padding: '0 5.128vw',
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(32px, 7vw, 96px)',
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-primary)',
                margin: 0,
                color: '#fff',
              }}
            >
              <span style={{ color: '#fff' }}>We</span>{' '}
              <CascadeText
                text="haul what others won't touch."
                progress={heroProgress}
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

      {/*
        Scroll runway. Invisible — just gives the page the
        scrollable height the rAF loop reads to drive the video
        scrub. The visible hero above is `position: fixed`, so
        it's not in this element's box. The runway height lives
        in CSS (.mkt-hero-runway in globals.css) and adapts per
        breakpoint.
      */}
      <section
        ref={sectionRef}
        className="mkt-hero-runway"
        aria-hidden
        style={{
          position: 'relative',
          // overflow-x clip so the 100vw fixed stage above
          // doesn't bleed horizontally; clip does NOT create
          // a Y scroll context that would break the runway's
          // sizing.
          overflowX: 'clip',
          // Behind the typewriter section but above the fixed
          // stage so anchor-link targets land here, not under
          // the hero video.
          zIndex: 1,
        }}
      />
    </>
  );
}
