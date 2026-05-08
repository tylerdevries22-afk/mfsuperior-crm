'use client';

import { useEffect, useRef } from 'react';

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
    description: "From single pickups to recurring routes, MF Superior Solutions handles the freight loads Colorado businesses actually need moved. We run 16ft to 26ft capacity across the Denver metro and beyond — so your operation never waits on a carrier.",
    wideVideo: '/videos/benefit-01-wide.mp4',
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

/**
 * Splits a heading string and underlines the last meaningful word.
 * Trailing punctuation is kept outside the underline.
 */
function HeadingWithUnderline({ text }: { text: string }) {
  // Find the last word (strip trailing punctuation for underline, reattach after)
  const match = text.match(/^(.*?)(\s*)(\S+?)([.,!?]*)$/);
  if (!match) {
    return <>{text}</>;
  }
  const [, before, space, lastWord, punctuation] = match;
  return (
    <>
      {before}
      {space}
      <span
        style={{
          textDecoration: 'underline',
          textDecorationThickness: '1px',
          textUnderlineOffset: '4px',
        }}
      >
        {lastWord}
      </span>
      {punctuation}
    </>
  );
}

interface BenefitVideoProps {
  src: string;
  num: string;
}

function BenefitVideo({ src, num }: BenefitVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Autoplay may be blocked — silently ignore
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="mkt-benefits-video"
      style={{
        width: '100%',
        height: '70vh',
        maxHeight: '720px',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#111111',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {/* Number marker */}
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
      {/* LEFT column */}
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
            fontSize: 'clamp(22px, 2.5vw, 36px)',
            fontWeight: 400,
            color: '#111111',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          <HeadingWithUnderline text={benefit.heading} />
        </h3>
      </div>

      {/* RIGHT column */}
      <div
        className="mkt-benefits-strip-right"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          paddingTop: '19px', // visual alignment with heading baseline
        }}
      >
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
    <section>
      {/* Section header */}
      <div
        className="mkt-benefits-header"
        style={{
          padding: '80px 5.128vw',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            color: '#7f7f7f',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: 0,
            maxWidth: '600px',
          }}
        >
          Built for businesses that need freight delivered on time, every time
        </p>
      </div>

      {/* Benefit blocks */}
      {benefits.map((benefit, index) => (
        <div key={benefit.num}>
          {/* Video strip */}
          <BenefitVideo src={benefit.wideVideo} num={benefit.num} />

          {/* Text strip */}
          <BenefitTextStrip
            benefit={benefit}
            isLast={index === benefits.length - 1}
          />
        </div>
      ))}
    </section>
  );
}
