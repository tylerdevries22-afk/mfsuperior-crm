'use client';

import { useEffect, useState } from 'react';
import { MFLogo, LockIcon } from './icons';

const NAV_LINKS = ['Fleet', 'Financing', 'Industries', 'About', 'Contact'];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <nav
        className="mkt-navbar"
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
          padding: '10px 20px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: scrolled ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
          transition: 'background 0.4s ease, backdrop-filter 0.4s ease',
        }}
      >
        {/* Logo — hidden on mobile so only actions show */}
        <div className="mkt-nav-logo" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <MFLogo width={90} height={54} />
        </div>

        {/* Desktop: center nav links */}
        <div
          className="mkt-nav-links-desktop"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {NAV_LINKS.map((label) => (
            <button
              key={label}
              style={{
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
                minHeight: '44px',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.9')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Desktop: right actions */}
        <div className="mkt-nav-actions-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
              textDecoration: 'none',
              transition: 'background 0.2s ease, border-color 0.2s ease',
              minHeight: '44px',
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
          <button
            style={{
              padding: '10px 16px',
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
              minHeight: '44px',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.88')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
          >
            Quote
          </button>
          <button
            style={{
              padding: '10px 16px',
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
              minHeight: '44px',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.88')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
          >
            Call Us
          </button>
        </div>

        {/* Mobile: action-only header — Login, Quote, Call Us, Hamburger */}
        <div
          className="mkt-nav-mobile-actions"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <a
            href="/login"
            aria-label="Login"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              fontFamily: 'inherit',
              textDecoration: 'none',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            <LockIcon width={14} height={14} />
          </a>
          <a
            href="tel:+12564680751"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--c-lime)',
              color: 'var(--c-dark-green)',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
              textDecoration: 'none',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            Call
          </a>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '5px',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            <span style={{ width: '18px', height: '1.5px', background: '#fff', display: 'block', transition: 'transform 0.25s ease', transformOrigin: 'center', transform: menuOpen ? 'rotate(45deg) translate(4.5px, 4.5px)' : 'none' }} />
            <span style={{ width: '18px', height: '1.5px', background: '#fff', display: 'block', transition: 'opacity 0.25s ease', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ width: '18px', height: '1.5px', background: '#fff', display: 'block', transition: 'transform 0.25s ease', transformOrigin: 'center', transform: menuOpen ? 'rotate(-45deg) translate(4.5px, -4.5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: '#111111',
          display: 'flex',
          flexDirection: 'column',
          padding: '100px 24px 48px',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto',
        }}
      >
        {NAV_LINKS.map((label) => (
          <button
            key={label}
            onClick={() => setMenuOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '28px',
              fontWeight: 400,
              fontFamily: 'var(--font-primary)',
              padding: '20px 0',
              textAlign: 'left',
              cursor: 'pointer',
              minHeight: '64px',
            }}
          >
            {label}
          </button>
        ))}

        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a
            href="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '15px',
              textDecoration: 'none',
              fontFamily: 'var(--font-primary)',
              minHeight: '56px',
            }}
          >
            <LockIcon width={15} height={15} />
            Login
          </a>
          <a
            href="tel:+12564680751"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '18px',
              borderRadius: '12px',
              background: 'var(--c-lime)',
              color: 'var(--c-dark-green)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: 'var(--font-primary)',
              minHeight: '56px',
            }}
          >
            Call Us — (256) 468-0751
          </a>
        </div>
      </div>
    </>
  );
}
