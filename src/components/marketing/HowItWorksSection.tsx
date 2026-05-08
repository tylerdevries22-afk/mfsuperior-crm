'use client';

import { useState } from 'react';
import { CascadeText } from './CascadeText';

interface FormState {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  message: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  fontSize: '15px',
  fontFamily: 'var(--font-primary)',
  color: '#111111',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box',
};

function FormInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  name,
  required,
}: {
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? '#111111' : '#e5e5e5',
      }}
    />
  );
}

function FormTextarea({
  placeholder,
  value,
  onChange,
  name,
  rows,
}: {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  name: string;
  rows: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        resize: 'vertical',
        borderColor: focused ? '#111111' : '#e5e5e5',
      }}
    />
  );
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function HowItWorksSection() {
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    message: '',
  });

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitHovered, setSubmitHovered] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitState === 'submitting') return;
    setSubmitState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          phone: form.phone,
          company: form.company,
          message: form.message,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Something went wrong. Please try again.');
      }
      setSubmitState('success');
      setForm({ firstName: '', lastName: '', company: '', email: '', phone: '', message: '' });
    } catch (err) {
      setSubmitState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <section
      id="contact"
      style={{
        backgroundColor: '#fff',
        position: 'relative',
        overflow: 'hidden',
        scrollMarginTop: '80px',
      }}
    >
      {/* Decorative SVG — curved left-rail line */}
      <svg
        aria-hidden="true"
        className="mkt-howitworks-svg"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '80px',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
        viewBox="0 0 80 800"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 40 0 Q 40 100 20 180 Q 0 260 20 340 Q 40 420 20 500 Q 0 580 20 660 Q 40 740 40 800"
          stroke="#e5e5e5"
          strokeWidth="1"
          fill="none"
        />
        {/* Small rounded rect notch shapes */}
        <rect x="24" y="160" width="32" height="8" rx="4" fill="#e5e5e5" />
        <rect x="24" y="320" width="32" height="8" rx="4" fill="#e5e5e5" />
      </svg>

      {/* ── Section header ── */}
      <div
        style={{
          paddingTop: '80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <p
          style={{
            color: '#7f7f7f',
            fontSize: '13px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            marginBottom: '16px',
            margin: '0 0 16px 0',
          }}
        >
          How It Works
        </p>
        <h2
          style={{
            fontSize: 'clamp(28px, 3.5vw, 52px)',
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: '800px',
            margin: '0 auto 64px',
            lineHeight: 1.2,
            fontFamily: 'var(--font-primary)',
            padding: '0 24px',
            color: '#111111',
          }}
        >
          <CascadeText
            text="Tell us your freight needs — we'll handle the rest"
            stagger={0.022}
            duration={0.5}
            finalColor="#111111"
            flashColor="#D4E030"
            restColor="rgba(17,17,17,0.2)"
          />
        </h2>
      </div>

      {/* ── Two-column layout ── */}
      <div
        className="mkt-howitworks-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px',
          padding: '0 5.128vw 120px',
          alignItems: 'start',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* LEFT — Contact form */}
        <div>
          <p
            style={{
              color: '#7f7f7f',
              fontSize: '15px',
              lineHeight: 1.6,
              marginBottom: '32px',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Fill out the form and a member of our team will reach out same day
            to discuss your freight needs and build a custom quote:
          </p>

          {submitState === 'success' ? (
            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(212,224,48,0.12)',
                  border: '1px solid rgba(212,224,48,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: '20px',
                  color: '#A0B41E',
                }}
              >
                &#10003;
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '20px',
                  fontWeight: 400,
                  color: '#111111',
                  marginBottom: '8px',
                }}
              >
                Request received
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '14px',
                  color: '#7f7f7f',
                  lineHeight: 1.6,
                  marginBottom: '24px',
                }}
              >
                Tyler will reach out within 24 hours to build your custom quote.
                You can also call directly at (256) 468-0751.
              </p>
              <button
                onClick={() => setSubmitState('idle')}
                style={{
                  background: 'none',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  color: '#7f7f7f',
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  padding: '10px 20px',
                  cursor: 'pointer',
                }}
              >
                Submit another
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit}>
            {/* First name + Last name */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <FormInput
                name="firstName"
                placeholder="First name"
                value={form.firstName}
                onChange={handleChange}
                required
              />
              <FormInput
                name="lastName"
                placeholder="Last name"
                value={form.lastName}
                onChange={handleChange}
              />
            </div>

            {/* Company */}
            <div style={{ marginBottom: '20px' }}>
              <FormInput
                name="company"
                placeholder="Company"
                value={form.company}
                onChange={handleChange}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '20px' }}>
              <FormInput
                type="email"
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: '20px' }}>
              <FormInput
                type="tel"
                name="phone"
                placeholder="Phone number"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: '20px' }}>
              <FormTextarea
                name="message"
                placeholder="Message"
                value={form.message}
                onChange={handleChange}
                rows={4}
              />
            </div>

            {submitState === 'error' && (
              <p
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                  color: '#ff6b6b',
                  padding: '10px 14px',
                  background: 'rgba(255,107,107,0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,107,107,0.2)',
                  marginBottom: '16px',
                }}
              >
                {errorMsg}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitState === 'submitting'}
              onMouseEnter={() => setSubmitHovered(true)}
              onMouseLeave={() => setSubmitHovered(false)}
              style={{
                width: '100%',
                background: submitState === 'submitting' ? '#555' : submitHovered ? '#1a1a1a' : '#111111',
                color: '#fff',
                padding: '16px',
                fontSize: '12px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                border: 'none',
                borderRadius: '8px',
                cursor: submitState === 'submitting' ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              {submitState === 'submitting' ? 'SENDING…' : 'SUBMIT'}
            </button>
          </form>
          )}
        </div>

        {/* RIGHT — Floating dark contact card */}
        <div
          style={{
            position: 'sticky',
            top: '120px',
            background: '#111111',
            borderRadius: '20px',
            padding: '40px',
            color: '#fff',
            overflow: 'hidden',
          }}
        >
          {/* Radial blue glow — decorative */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: '-40px',
              left: '-40px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(212,224,48,0.35) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* SUBMIT label row at top */}
          <div
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '16px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
              }}
            >
              Submit
            </span>
          </div>

          {/* Card content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Small decorative blue dot */}
            <div
              aria-hidden="true"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#D4E030',
                marginBottom: '24px',
              }}
            />

            <h3
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: 'clamp(20px, 2vw, 28px)',
                fontWeight: 400,
                color: '#fff',
                lineHeight: 1.3,
                marginBottom: '16px',
                margin: '0 0 16px 0',
              }}
            >
              Ready to move your freight?
            </h3>

            <p
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.6,
                marginBottom: '32px',
              }}
            >
              MF Superior Solutions handles your freight from pickup to final mile — professionally and on time, every time.
            </p>

            {/* Divider */}
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: '24px',
                marginTop: '8px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '8px',
                  margin: '0 0 8px 0',
                }}
              >
                Or just call
              </p>
              <a
                href="tel:+12564680751"
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '28px',
                  fontWeight: 500,
                  color: '#fff',
                  textDecoration: 'none',
                  display: 'block',
                  marginBottom: '8px',
                  letterSpacing: '-0.01em',
                }}
              >
                (256) 468-0751
              </a>
              <a
                href="mailto:info@mfsuperiorproducts.com"
                style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'none',
                  display: 'block',
                  marginBottom: '32px',
                }}
              >
                info@mfsuperiorproducts.com
              </a>

              {/* Feature list */}
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {[
                  'Professional, licensed, and insured drivers',
                  'Same-day and next-day scheduling available',
                  'Transparent rates — no hidden fees',
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontFamily: 'var(--font-primary)',
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {/* Lime checkmark dot */}
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#D4E030',
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
