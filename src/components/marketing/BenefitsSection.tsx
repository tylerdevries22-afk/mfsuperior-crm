'use client';

import { useEffect, useRef } from 'react';
import { CascadeText } from './CascadeText';

interface Benefit {
  num: string;
  label: string;
  heading: string;
  description: string;
  wideVideo: string;
}

const benefits: Benefit[] = [
  {
    num: '01',
    label: 'Benefit 01',
    heading: 'One reliable partner for all your Colorado freight runs',
    description: "From single pickups to recurring routes, MF Superior Products handles the freight loads Colorado businesses actually need moved. We run 16ft to 26ft capacity across the Denver metro and beyond — so your operation never waits on a carrier.",
    wideVideo: '/videos/features-01.mp4',
  },
  {
    num: '02',
    label: 'Benefit 02',
    heading: 'Dispatched and on the road the same week',
    description: "Every run is handled by professional, insured drivers who treat your freight like their own. Our streamlined scheduling process means you can go from inquiry to confirmed dispatch without the back-and-forth of traditional carriers.",
    wideVideo: '/videos/benefit-02-wide.mp4',
  },
  {
    num: '03',
    label: 'Benefit 03',
    heading: 'Transparent rates that work for your budget',
    description: "We work directly with your business, not through brokers. Competitive rates, clear billing, and no hidden fees. Whether you need a one-time haul or an ongoing delivery contract, we price it so it makes sense for your operation from day one.",
    wideVideo: '/videos/benefit-03-wide.mp4',
  },
];


interface BenefitVideoProps {
  src: string;
  poster: string;
  num: string;
}

function BenefitVideo({ src, poster, num }: BenefitVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    // Scroll-scrubbed playback (same pattern as HeroSection). Pauses
    // the video and drives currentTime off scroll position, so the
    // clip plays forward as the user scrolls down and rewinds as they
    // scroll up. Every other animation on the page (text cascades, MF
    // font growth, hero scrub) responds to scroll — the benefit
    // videos now do too, so the page feels cohesive.
    //
    // Progress is measured over the video's viewport traversal:
    // (viewH - rect.top) / (viewH + rect.height) → 0 when the video's
    // top edge is one viewport below the fold, 1 when its bottom edge
    // is one viewport above the fold. That gives ~80vh (video) + 100vh
    // (viewport) = 180vh of scroll runway per clip. For a ~10s clip
    // the scrub feels ~18vh/sec — half the hero's 50vh/sec pace,
    // deliberate but not sleepy.
    video.pause();
    let started = false;
    let raf = 0;

    const tick = () => {
      const rect = container.getBoundingClientRect();
      const viewH = window.innerHeight;
      const p = (viewH - rect.top) / (viewH + rect.height);
      const progress = Math.max(0, Math.min(1, p));
      if (video.readyState >= 2 && video.duration > 0) {
        video.currentTime = progress * video.duration;
      }
      raf = requestAnimationFrame(tick);
    };

    // rAF only ticks when the section is near the viewport so the
    // decoder isn't running off-screen. rootMargin pre-warms the next
    // clip ~one viewport before it scrolls in so there's no flash of
    // poster when it arrives.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!started) {
            video.preload = "auto";
            started = true;
          }
          raf = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="mkt-benefits-video"
      style={{
        width: '100%',
        height: '80vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#111111',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: '5.128vw',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {num}
      </span>
    </div>
  );
}

interface BenefitTextStripProps {
  benefit: Benefit;
  isLast: boolean;
}

function BenefitTextStrip({ benefit, isLast }: BenefitTextStripProps) {
  return (
    <div
      className="mkt-benefits-strip"
      style={{
        backgroundColor: '#fff',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '40px',
        padding: '48px 5.128vw',
        borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
      }}
    >
      <div>
        <p
          style={{
            fontSize: '11px',
            color: '#7f7f7f',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '8px',
            margin: '0 0 8px 0',
          }}
        >
          {benefit.label}
        </p>
        <h3
          style={{
            fontSize: 'clamp(24px, 2.5vw, 36px)',
            fontWeight: 400,
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.15,
            margin: 0,
            color: '#111111',
          }}
        >
          <CascadeText
            text={benefit.heading}
            scrollLinked
            spread={0.55}
            offset={['start 85%', 'start 35%']}
            finalColor="#111111"
            flashColor="#D4E030"
            restColor="rgba(17,17,17,0.18)"
          />
        </h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '19px' }}>
        <p
          style={{
            fontSize: '16px',
            color: '#7f7f7f',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          {benefit.description}
        </p>
      </div>
    </div>
  );
}

export function BenefitsSection() {
  return (
    <section id="industries" style={{ scrollMarginTop: '80px' }}>
      <div
        style={{
          padding: '80px 5.128vw',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: 0,
            maxWidth: '600px',
            color: '#7f7f7f',
          }}
        >
          <CascadeText
            text="Built for businesses that need freight delivered on time, every time"
            scrollLinked
            spread={0.6}
            offset={['start 90%', 'start 45%']}
            finalColor="#7f7f7f"
            flashColor="#D4E030"
            restColor="rgba(127,127,127,0.25)"
          />
        </p>
      </div>

      {benefits.map((benefit, index) => (
        <div key={benefit.num}>
          <BenefitVideo
            src={benefit.wideVideo}
            poster={benefit.wideVideo.replace(/\.mp4$/, '.jpg')}
            num={benefit.num}
          />
          <BenefitTextStrip benefit={benefit} isLast={index === benefits.length - 1} />
        </div>
      ))}
    </section>
  );
}
