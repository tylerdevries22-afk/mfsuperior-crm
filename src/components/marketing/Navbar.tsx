'use client';

import { useEffect, useState } from 'react';
import { MFLogo, ChevronDownIcon, LockIcon } from './icons';

const NAV_LINKS: { label: string; hasDropdown: boolean }[] = [
  { label: 'Fleet', hasDropdown: true },
  { label: 'Financing', hasDropdown: true },
  { label: 'Industries', hasDropdown: false },
  { label: 'About', hasDropdown: false },
  { label: 'Contact', hasDropdown: false },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        width: 'calc(100% - 2 * 5.128vw)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: scrolled ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease',
      }}
    >
      {/* LEFT: Logo */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <MFLogo width={110} height={66} />
      </div>

      {/* CENTER: Nav Links */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {NAV_LINKS.map(({ label, hasDropdown }) => (
          <button
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'inherit',
              padding: '4px 0',
              opacity: 0.9,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.9')}
          >
            {label}
            {hasDropdown && (
              <ChevronDownIcon
                width={14}
                height={14}
                style={{ color: 'white', opacity: 0.7, marginTop: '1px' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* RIGHT: Login + Quote + Call Us */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Login button */}
        <a
          href="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: 'inherit',
            textDecoration: 'none',
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'rgba(255,255,255,0.1)';
            el.style.borderColor = 'rgba(255,255,255,0.5)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'transparent';
            el.style.borderColor = 'rgba(255,255,255,0.3)';
          }}
        >
          <LockIcon width={13} height={13} />
          Login
        </a>

        {/* DEMO button */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'white',
            border: 'none',
            cursor: 'pointer',
            color: '#111111',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'inherit',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.88')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          Quote
        </button>

        {/* CALL US button */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'var(--c-lime)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--c-dark-green)',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'inherit',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.88')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          Call Us
        </button>
      </div>
    </nav>
  );
}
