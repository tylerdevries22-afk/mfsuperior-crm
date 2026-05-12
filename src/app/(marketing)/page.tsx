import LenisProvider from "@/components/marketing/LenisProvider";
import Navbar from "@/components/marketing/Navbar";
import { HeroSection } from "@/components/marketing/HeroSection";
import { TypewriterSection } from "@/components/marketing/TypewriterSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { YosSection } from "@/components/marketing/YosSection";
import { BenefitsSection } from "@/components/marketing/BenefitsSection";
import { TestimonialSection } from "@/components/marketing/TestimonialSection";
import { LogosSection } from "@/components/marketing/LogosSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { CtaSection } from "@/components/marketing/CtaSection";
import { Footer } from "@/components/marketing/Footer";
import { InteractiveGridCanvas } from "@/components/marketing/InteractiveGridCanvas";

// HowItWorksSection owns the #contact form anchor for the navbar
// scroll-spy. The standalone ContactSection.tsx was a duplicate and
// has been deleted from the source tree.

export default function Home() {
  return (
    <LenisProvider>
      <Navbar />
      <main>
        <HeroSection />
        {/* InteractiveGridCanvas IS the white panel that scrolls
            up over the fixed hero. It owns the `-100vh` top-
            margin overlay, the rounded top corners, and the
            interactive yellow spotlight that follows the cursor
            on desktop and the touch point on mobile. Everything
            inside — Typewriter through CTA — sits on a single
            continuous canvas so the visual flows uninterrupted
            from the headline pull-quote all the way to the CTA
            footer card. */}
        <InteractiveGridCanvas>
          <TypewriterSection />
          <FeaturesSection />
          <YosSection />
          <BenefitsSection />
          <TestimonialSection />
          <LogosSection />
          <HowItWorksSection />
          <CtaSection />
        </InteractiveGridCanvas>
      </main>
      <Footer />
    </LenisProvider>
  );
}
