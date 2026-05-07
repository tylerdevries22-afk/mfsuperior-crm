'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface FeatureItem {
  num: string;
  heading: string;
  video: string;
  overlay: string | null;
}

const items: FeatureItem[] = [
  { num: '01', heading: 'Box trucks from 16ft to 26ft — the right size for every job', video: '/videos/features-01.mp4', overlay: null },
  { num: '02', heading: 'Fleet-ready inventory with same-day availability in Denver', video: '/videos/features-03.mp4', overlay: 'IN STOCK ✓' },
  { num: '03', heading: 'Financing and lease options with fast same-week approvals', video: '/videos/features-02.mp4', overlay: 'APPROVED ✓' },
  { num: '04', heading: 'Every truck inspected, maintained, and road-tested before delivery', video: '/videos/features-04.mp4', overlay: null },
  { num: '05', heading: 'Liftgate, GPS, and refrigeration-ready configurations available', video: '/videos/features-05.mp4', overlay: null },
  { num: '06', heading: 'White-glove delivery and ongoing support across Colorado', video: '/videos/features-06.mp4', overlay: 'DELIVERED ✓' },
];

export function FeaturesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoOpacity, setVideoOpacity] = useState(1);
  const [displayedVideo, setDisplayedVideo] = useState(items[0].video);
  const [displayedOverlay, setDisplayedOverlay] = useState<string | null>(items[0].overlay);

  const videoRef = useRef<HTMLVideoElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingIndexRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);

  // Crossfade to new video when active index changes
  const transitionToIndex = useCallback((newIndex: number) => {
    if (isTransitioningRef.current) {
      pendingIndexRef.current = newIndex;
      return;
    }

    if (displayedVideo === items[newIndex].video) return;

    isTransitioningRef.current = true;

    // Fade out
    setVideoOpacity(0);

    setTimeout(() => {
      setDisplayedVideo(items[newIndex].video);
      setDisplayedOverlay(items[newIndex].overlay);

      // Allow one frame for the src to update, then fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVideoOpacity(1);
          setTimeout(() => {
            isTransitioningRef.current = false;
            // If a pending index was queued, run it now
            if (pendingIndexRef.current !== null && pendingIndexRef.current !== newIndex) {
              const pending = pendingIndexRef.current;
              pendingIndexRef.current = null;
              transitionToIndex(pending);
            } else {
              pendingIndexRef.current = null;
            }
          }, 400);
        });
      });
    }, 400);
  }, [displayedVideo]);

  useEffect(() => {
    transitionToIndex(activeIndex);
  }, [activeIndex, transitionToIndex]);

  // IntersectionObserver: activate item when it crosses the middle of the viewport
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    itemRefs.current.forEach((el, index) => {
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveIndex(index);
            }
          });
        },
        {
          threshold: 0.5,
          rootMargin: '-20% 0px -20% 0px',
        }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  return (
    <section
      style={{
        width: '100%',
        backgroundColor: '#fff',
        paddingTop: '120px',
      }}
    >
      {/* Section heading block — centered above two-column layout */}
      <div
        style={{
          textAlign: 'center',
          paddingLeft: '5.128vw',
          paddingRight: '5.128vw',
        }}
      >
        <p
          style={{
            fontSize: '20px',
            color: '#111111',
            fontFamily: 'var(--font-primary)',
            fontWeight: 400,
            lineHeight: 1.4,
            marginBottom: '24px',
          }}
        >
          Reliable box trucks built for Colorado's toughest routes.
        </p>

        <h2
          style={{
            fontSize: 'clamp(32px, 4vw, 56px)',
            fontWeight: 400,
            color: '#111111',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-primary)',
            maxWidth: '900px',
            margin: '0 auto 80px',
          }}
        >
          Imagine a fleet that works as hard as you do — from pickup to final mile delivery.
        </h2>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        {/* Left column — scrollable, 42% width */}
        <div
          style={{
            width: '42%',
            flexShrink: 0,
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.num}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              style={{
                padding: '80px 5.128vw 80px 5.128vw',
                minHeight: '280px',
              }}
            >
              {/* Item number */}
              <p
                style={{
                  fontSize: '11px',
                  color: '#7f7f7f',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  marginBottom: '16px',
                  fontWeight: 400,
                }}
              >
                {item.num}
              </p>

              {/* Item heading */}
              <h3
                style={{
                  fontSize: 'clamp(24px, 2.5vw, 38px)',
                  fontWeight: 400,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-primary)',
                  color: activeIndex === index ? '#111111' : '#ddd',
                  transition: 'color 0.5s ease',
                  margin: 0,
                }}
              >
                {item.heading}
              </h3>
            </div>
          ))}
        </div>

        {/* Right column — sticky panel, 58% width */}
        <div
          style={{
            width: '58%',
            flexShrink: 0,
            position: 'sticky',
            top: '80px',
            height: 'calc(100vh - 100px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
              borderRadius: '24px 0 0 0',
              overflow: 'hidden',
            }}
          >
            {/* Video element */}
            <video
              ref={videoRef}
              key={displayedVideo}
              src={displayedVideo}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                opacity: videoOpacity,
                transition: 'opacity 0.4s ease',
              }}
            />

            {/* Overlay badge */}
            {displayedOverlay && (
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: '#D4E030',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '0.15em',
                  padding: '6px 12px',
                  borderRadius: '4px',
                }}
              >
                {displayedOverlay}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
