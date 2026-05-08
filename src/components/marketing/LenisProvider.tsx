'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';

declare global {
  interface Window {
    __mfsLenis?: Lenis;
  }
}

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true });
    // Expose under a project-private key so the navbar's click-to-scroll
    // handler can drive Lenis directly. (We avoid `window.lenis` because
    // the Lenis type package already augments that key with a different
    // shape — a config-style object — so overriding it is a TS collision.)
    window.__mfsLenis = lenis;
    return () => {
      lenis.destroy();
      window.__mfsLenis = undefined;
    };
  }, []);
  return <>{children}</>;
}
