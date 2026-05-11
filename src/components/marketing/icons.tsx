import React from 'react';

type SVGProps = React.SVGProps<SVGSVGElement>;

export function MFLogo({ className, width = 110, height = 66 }: { className?: string; width?: number; height?: number }) {
  return (
    <img
      src="/images/mf-logo-text.png?v=2"
      alt="MF Superior Products"
      width={width}
      height={height}
      className={`logo-neon-glow ${className ?? ''}`.trim()}
      style={{ objectFit: 'contain' }}
    />
  );
}

export function MFMark({ className, width = 60, height = 60 }: { className?: string; width?: number; height?: number }) {
  return (
    <img
      src="/images/mf-logo-mark.png?v=2"
      alt="MF Superior Products"
      width={width}
      height={height}
      className={`logo-neon-glow ${className ?? ''}`.trim()}
      style={{ objectFit: 'contain' }}
    />
  );
}

export function TerminalLogo(props: SVGProps & { className?: string; width?: number; height?: number }) {
  return <MFMark width={props.width ?? 60} height={props.height ?? 60} className={props.className} />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TerminalWordmark(_props: { className?: string }) {
  return null;
}

export function ChevronDownIcon({ width = 16, height = 16, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArrowRightIcon({ width = 16, height = 16, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PhoneIcon({ width = 24, height = 24, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.47 11.47 0 003.59.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

export function SparkleIcon({ width = 16, height = 16, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M8 0l1.5 6.5L16 8l-6.5 1.5L8 16l-1.5-6.5L0 8l6.5-1.5z" />
    </svg>
  );
}

export function LockIcon({ width = 14, height = 14, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="3" y="7" width="10" height="8" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" strokeLinecap="round" />
    </svg>
  );
}

export function LinkedInIcon({ width = 20, height = 20, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="24" height="24" rx="4" fill="currentColor" opacity="0" />
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function XIcon({ width = 20, height = 20, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

export function YouTubeIcon({ width = 20, height = 20, ...props }: SVGProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
