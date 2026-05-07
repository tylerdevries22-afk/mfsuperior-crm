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
    heading: 'One source for your entire box truck fleet',
    description: "From single-unit purchases to full fleet buildouts, MF Superior Products stocks the sizes and configurations Colorado operators actually need. We carry 16ft, 20ft, 22ft, and 26ft box trucks with immediate availability — so your operation never waits on inventory.",
    wideVideo: '/videos/benefit-01-wide.mp4',
  },
  {
    num: '02',
    label: 'Benefit 02',
    heading: 'Drive away the same week',
    description: "Every truck in our inventory is inspected, detailed, and road-ready before it ever reaches a customer. Our streamlined paperwork process and in-house financing options mean you can go from inquiry to keys in hand without the dealership runaround.",
    wideVideo: '/videos/benefit-02-wide.mp4',
  },
  {
    num: '03',
    label: 'Benefit 03',
    heading: 'Pricing that works for your margins',
    description: "We work directly with fleet operators, not middlemen. Competitive pricing on all units, flexible financing terms, and no hidden fees. Whether you're buying one truck or building a fleet, we price it so it pencils for your business from day one.",
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
            fontSize: 'clamp(24px, 2.5vw, 36px)',
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
          Built for operators who need trucks that show up and stay running
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
