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

// HowItWorksSection owns the #contact form anchor for the navbar
// scroll-spy. The standalone ContactSection.tsx was a duplicate and
// has been deleted from the source tree.

export default function Home() {
  return (
    <LenisProvider>
      <Navbar />
      <main>
        <HeroSection />
        <TypewriterSection />
        <FeaturesSection />
        <YosSection />
        <BenefitsSection />
        <TestimonialSection />
        <LogosSection />
        <HowItWorksSection />
        <CtaSection />
      </main>
      <Footer />
    </LenisProvider>
  );
}
