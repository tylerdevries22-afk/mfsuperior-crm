'use client';

import { useState } from 'react';

interface Logo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const logos: Logo[] = [
  { src: '/images/logos/ryder.svg', alt: 'Ryder', width: 147, height: 41 },
  { src: '/images/logos/prologis.svg', alt: 'Prologis', width: 181, height: 34 },
  { src: '/images/logos/nfi.svg', alt: 'NFI Logistics', width: 118, height: 46 },
  { src: '/images/logos/lineage.svg', alt: 'Lineage Logistics', width: 170, height: 44 },
  { src: '/images/logos/8vc.svg', alt: '8VC', width: 114, height: 45 },
  { src: '/images/logos/coca-cola.svg', alt: 'Coca-Cola Fleet', width: 300, height: 94 },
  { src: '/images/logos/hp.svg', alt: 'HP Distribution', width: 48, height: 48 },
];

function LogoCell({ logo }: { logo: Logo }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        borderRight: '1px solid #e5e5e5',
      }}
    >
      <img
        src={logo.src}
        alt={logo.alt}
        style={{
          maxHeight: '36px',
          maxWidth: '100px',
          objectFit: 'contain',
          filter: hovered ? 'none' : 'grayscale(100%)',
          opacity: hovered ? 1 : 0.7,
          transition: 'all 0.3s',
          width: 'auto',
          height: 'auto',
        }}
      />
    </div>
  );
}

export function LogosSection() {
  return (
    <section
      style={{
        backgroundColor: '#fff',
        padding: '80px 5.128vw',
        backgroundImage:
          'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Label */}
      <p
        style={{
          textAlign: 'center',
          fontSize: '13px',
          color: '#7f7f7f',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '48px',
          fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
        }}
      >
        Trusted by Colorado Operators
      </p>

      {/* Sub-heading */}
      <h2
        style={{
          fontSize: 'clamp(24px, 3vw, 40px)',
          color: '#111111',
          fontWeight: 400,
          textAlign: 'center',
          maxWidth: '700px',
          margin: '0 auto 64px',
          lineHeight: 1.3,
          fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
        }}
      >
        Colorado&apos;s top operators trust MF Superior Solutions
      </h2>

      {/* Logos grid */}
      <div
        className="mkt-logos-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          border: '1px solid #e5e5e5',
        }}
      >
        {logos.map((logo) => (
          <LogoCell key={logo.alt} logo={logo} />
        ))}
      </div>
    </section>
  );
}
