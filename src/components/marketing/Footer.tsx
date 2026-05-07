'use client';

import { useState } from 'react';
import { TerminalLogo, LinkedInIcon, XIcon, YouTubeIcon } from './icons';

interface FooterLink {
  label: string;
  href: string;
}

const technologyLinks: FooterLink[] = [
  { label: 'Homepage', href: '/' },
  { label: 'Box Trucks', href: '/box-trucks' },
  { label: 'Liftgate Options', href: '/liftgate-options' },
  { label: 'Fleet Financing', href: '/fleet-financing' },
];

const companyLinks: FooterLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
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
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 1fr 1fr',
          gap: '40px',
          padding: '64px 5.128vw 40px',
        }}
      >
        {/* Column 1: Brand */}
        <div>
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

        {/* Column 2: Technology */}
        <div>
          <p style={columnHeaderStyle}>Fleet</p>
          {technologyLinks.map((link) => (
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
            Ready to grow your fleet?
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
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '24px 5.128vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          Copyright MF Superior Products &copy; 2025 All Rights Reserved
        </span>
        <a
          href="/sitemap"
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            textDecoration: 'none',
          }}
        >
          Sitemap
        </a>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          15321 E Louisiana Ave, Aurora, CO 80017
        </span>
      </div>
    </footer>
  );
}
