interface Logo {
  src: string;
  alt: string;
}

const logos: Logo[] = [
  { src: '/images/logos/ryder.svg', alt: 'Ryder' },
  { src: '/images/logos/prologis.svg', alt: 'Prologis' },
  { src: '/images/logos/nfi.svg', alt: 'NFI Logistics' },
  { src: '/images/logos/lineage.svg', alt: 'Lineage Logistics' },
  { src: '/images/logos/8vc.svg', alt: '8VC' },
  { src: '/images/logos/coca-cola.svg', alt: 'Coca-Cola Fleet' },
  { src: '/images/logos/hp.svg', alt: 'HP Distribution' },
];

export function LogosSection() {
  return (
    <section
      style={{
        backgroundColor: '#fff',
        padding: '80px 0',
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
          padding: '0 5.128vw',
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
          padding: '0 5.128vw',
        }}
      >
        Colorado&apos;s top operators trust MF Superior Solutions
      </h2>

      {/* Infinite marquee */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderTop: '1px solid #e5e5e5',
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        {/* Left fade */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '140px',
            background: 'linear-gradient(to right, #fff, transparent)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
        {/* Right fade */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '140px',
            background: 'linear-gradient(to left, #fff, transparent)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />

        {/* Scrolling track — duplicated for seamless loop */}
        <div style={{ display: 'flex', animation: 'marquee 30s linear infinite', width: 'max-content' }}>
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 56px',
                flexShrink: 0,
                borderRight: '1px solid #e5e5e5',
              }}
            >
              <img
                src={logo.src}
                alt={logo.alt}
                style={{
                  maxHeight: '36px',
                  maxWidth: '110px',
                  objectFit: 'contain',
                  filter: 'grayscale(100%)',
                  opacity: 0.6,
                  width: 'auto',
                  height: 'auto',
                  transition: 'filter 0.3s, opacity 0.3s',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
