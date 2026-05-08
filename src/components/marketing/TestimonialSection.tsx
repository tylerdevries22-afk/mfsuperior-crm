export function TestimonialSection() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background photo */}
      <img
        src="/images/quote-image.jpg"
        alt="Winter forest with truck"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Top-left white notch cutout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '160px',
          height: '60px',
          background: '#fff',
          borderBottomRightRadius: '40px',
        }}
      />

      {/* Top-right white notch cutout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '160px',
          height: '60px',
          background: '#fff',
          borderBottomLeftRadius: '40px',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '80px 5.128vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <blockquote
          style={{
            fontSize: 'clamp(20px, 2.5vw, 36px)',
            fontWeight: 400,
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.45,
            maxWidth: '900px',
            margin: '0 auto 40px',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
            fontStyle: 'normal',
          }}
        >
          &ldquo;MF Superior made our distribution seamless. We needed multiple
          deliveries across Denver in a tight window and they came through every
          time — professional drivers, on time, no excuses.&rdquo;
        </blockquote>

        <p
          style={{
            color: '#fff',
            fontSize: '16px',
            textAlign: 'center',
            marginBottom: '4px',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
          }}
        >
          Marcus Webb
        </p>

        <p
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '4px',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
          }}
        >
          Operations Manager
        </p>

        <p
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px',
            textAlign: 'center',
            fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
          }}
        >
          Denver Direct Logistics
        </p>
      </div>
    </section>
  );
}
