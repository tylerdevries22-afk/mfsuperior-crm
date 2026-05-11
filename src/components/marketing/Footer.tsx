'use client';

import { useState } from 'react';
import { TerminalLogo, LinkedInIcon, XIcon, YouTubeIcon } from './icons';

interface FooterLink {
  label: string;
  href: string;
}

// All footer links repointed to in-page anchor sections that actually
// exist (matching the navbar scroll-spy ids: #fleet, #industries,
// #about, #contact). Several previous links pointed at routes
// (/services, /liftgate-service, /about, /resources) that were
// 404-ing — repaired here.
const servicesLinks: FooterLink[] = [
  { label: 'Homepage', href: '#' },
  { label: 'Fleet capabilities', href: '#fleet' },
  { label: 'Industries we serve', href: '#industries' },
  { label: 'Get a quote', href: '#contact' },
];

const companyLinks: FooterLink[] = [
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        color: '#fff',
        fontSize: '15px',
        marginBottom: '16px',
        textDecoration: 'none',
        opacity: hovered ? 0.6 : 1,
        transition: 'opacity 0.2s',
        fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
      }}
    >
      {children}
    </a>
  );
}

const columnHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
  fontSize: '11px',
  letterSpacing: '0.15em',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  marginBottom: '24px',
};

export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: 'var(--c-dark-green)',
        fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
      }}
    >
      {/* Top columns */}
      <div
        className="mkt-footer-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 1fr 1fr',
          gap: '40px',
          padding: '64px 5.128vw 40px',
        }}
      >
        {/* Column 1: Brand */}
        <div className="mkt-footer-brand">
          {/* Logo + wordmark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '32px',
            }}
          >
            <TerminalLogo width={80} height={80} />
          </div>

          <div style={{ marginTop: '32px' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.6' }}>
              15321 E Louisiana Ave<br />
              Aurora, CO 80017<br />
              United States<br />
              <a href="mailto:info@mfsuperiorproducts.com" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                info@mfsuperiorproducts.com
              </a>
            </p>
          </div>
        </div>

        {/* Column 2: Services */}
        <div>
          <p style={columnHeaderStyle}>Services</p>
          {servicesLinks.map((link) => (
            <FooterLink key={link.label} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
        </div>

        {/* Column 3: Company */}
        <div>
          <p style={columnHeaderStyle}>Company</p>
          {companyLinks.map((link) => (
            <FooterLink key={link.label} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
        </div>

        {/* Column 4: Reach Us */}
        <div>
          <p style={columnHeaderStyle}>Reach Us &mdash;</p>
          <p
            style={{
              color: '#fff',
              fontSize: '18px',
              marginBottom: '16px',
              fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
            }}
          >
            Ready to move your freight?
          </p>
          <p
            style={{
              color: '#fff',
              fontSize: '24px',
              fontWeight: 500,
              marginBottom: '8px',
              fontFamily: 'var(--font-primary, SuisseIntl, sans-serif)',
            }}
          >
            +1 (256) 468-0751
          </p>
          <p
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
              marginBottom: '24px',
            }}
          >
            Give us a call today.
          </p>

          {/* Social icons */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <a href="https://linkedin.com" aria-label="LinkedIn" style={{ color: '#fff' }}>
              <LinkedInIcon width={24} height={24} />
            </a>
            <a href="https://x.com" aria-label="X" style={{ color: '#fff' }}>
              <XIcon width={24} height={24} />
            </a>
            <a href="https://youtube.com" aria-label="YouTube" style={{ color: '#fff' }}>
              <YouTubeIcon width={24} height={24} />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="mkt-footer-bottom"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '24px 5.128vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          &copy; 2026 MF Superior Products. All rights reserved.
        </span>
        {/* Address removed here — already lives in the brand column above. */}
        <a
          href="mailto:info@mfsuperiorproducts.com"
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            textDecoration: 'none',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--c-lime)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)')}
        >
          info@mfsuperiorproducts.com
        </a>
      </div>
    </footer>
  );
}
