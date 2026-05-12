'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MFLogo, LockIcon } from './icons';

/**
 * Each label is paired with the in-page section id it scrolls to.
 * Section ids are added to the matching component wrappers; the
 * scroll-spy below watches them via IntersectionObserver and lights
 * up the active label as it enters/leaves the viewport.
 */
const NAV_LINKS: Array<{ label: string; id: string }> = [
  { label: 'Fleet', id: 'fleet' },
  { label: 'Industries', id: 'industries' },
  { label: 'About', id: 'about' },
  { label: 'Contact', id: 'contact' },
];

/** Smooth-scroll helper. Honours Lenis if present (window.lenis), else
 *  falls back to native CSS scrollIntoView. The fixed-nav offset gets
 *  baked in via scroll-margin-top on the section. */
function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // window.__mfsLenis is set by LenisProvider (renamed off `lenis` to
  // avoid colliding with Lenis's own Window augmentation). Use its
  // scrollTo if available for smoother sync with Lenis's frame loop;
  // fall back to native scrollIntoView when Lenis isn't mounted.
  const lenis = window.__mfsLenis;
  if (lenis?.scrollTo) {
    lenis.scrollTo(el, { offset: -80, duration: 1.2 });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: pick whichever tracked section is currently most visible.
  useEffect(() => {
    const ids = NAV_LINKS.map((n) => n.id);
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    // Use a long top-margin so the section becomes "active" only once
    // its top has crossed roughly the upper third of the viewport —
    // the same point where it visually dominates the screen.
    const io = new IntersectionObserver(
      (entries) => {
        // Find the entry with the largest intersectionRatio that's
        // currently intersecting. If multiple match (overlapping), pick
        // the topmost (smallest top).
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) =>
            b.intersectionRatio - a.intersectionRatio ||
            a.boundingClientRect.top - b.boundingClientRect.top,
        );
        setActiveId(visible[0].target.id);
      },
      {
        // Trigger when section's top is at 30% of viewport, bottom at 60%.
        rootMargin: '-30% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
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
          border: '1px solid rgba(17,17,17,0.08)',
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: scrolled
            ? '0 8px 24px rgba(17,17,17,0.08)'
            : '0 4px 16px rgba(17,17,17,0.04)',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        {/* Logo — clickable home link with a responsive width-cap so the
            mark stays proportionate on phones without crowding the
            mobile call/menu cluster. CSS controls width on each
            breakpoint via .mkt-nav-logo (defined in globals.css). */}
        <Link
          href="/"
          aria-label="MF Superior — home"
          className="mkt-nav-logo"
          style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <MFLogo width={90} height={54} />
        </Link>

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
          {NAV_LINKS.map(({ label, id }) => {
            const active = activeId === id;
            return (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--c-dark-green)',
                  fontSize: '14px',
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'inherit',
                  padding: '4px 0',
                  opacity: active ? 1 : 0.7,
                  transition: 'opacity 0.2s ease, color 0.25s ease',
                  minHeight: '44px',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = active ? '1' : '0.85')}
              >
                {label}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '2px',
                    background: 'var(--c-lime)',
                    transformOrigin: 'left center',
                    transform: `scaleX(${active ? 1 : 0})`,
                    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </button>
            );
          })}
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
              border: '1px solid rgba(17,17,17,0.2)',
              color: 'var(--c-dark-green)',
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
              el.style.background = 'rgba(17,17,17,0.05)';
              el.style.borderColor = 'rgba(17,17,17,0.4)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = 'transparent';
              el.style.borderColor = 'rgba(17,17,17,0.2)';
            }}
          >
            <LockIcon width={13} height={13} />
            Login
          </a>
          <button
            onClick={() => scrollToSection('contact')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'var(--c-dark-green)',
              border: 'none',
              cursor: 'pointer',
              color: 'white',
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

        {/* Mobile: Call Us + Hamburger */}
        <div className="mkt-nav-mobile-actions" style={{ display: 'none', alignItems: 'center', gap: '8px' }}>
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
            }}
          >
            Call Us
          </a>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{
              background: 'none',
              border: '1px solid rgba(17,17,17,0.2)',
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
            <span style={{ width: '18px', height: '1.5px', background: '#111', display: 'block', transition: 'transform 0.25s ease', transformOrigin: 'center', transform: menuOpen ? 'rotate(45deg) translate(4.5px, 4.5px)' : 'none' }} />
            <span style={{ width: '18px', height: '1.5px', background: '#111', display: 'block', transition: 'opacity 0.25s ease', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ width: '18px', height: '1.5px', background: '#111', display: 'block', transition: 'transform 0.25s ease', transformOrigin: 'center', transform: menuOpen ? 'rotate(-45deg) translate(4.5px, -4.5px)' : 'none' }} />
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
        {NAV_LINKS.map(({ label, id }) => (
          <button
            key={id}
            onClick={() => {
              setMenuOpen(false);
              // Wait for the body-scroll-lock release before scrolling.
              setTimeout(() => scrollToSection(id), 320);
            }}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              color: activeId === id ? 'var(--c-lime)' : 'white',
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
