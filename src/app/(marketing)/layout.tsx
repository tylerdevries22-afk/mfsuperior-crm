import type { Metadata } from "next";

// One logo to rule them all — `/logo.png` is the canonical brand mark
// used in the app sidebar (src/components/nav/sidebar.tsx), the login
// screen (src/app/login/page.tsx), and the CRM root layout favicon
// (src/app/layout.tsx). Pointing every marketing surface (favicon,
// apple-touch, OG card, Twitter card) at the same file keeps the
// browser tab icon and the social-share preview visually identical to
// what users see in the top header.
const LOGO_URL = "/logo.png";
const SITE_NAME = "MF Superior Products";
const SITE_TITLE =
  "MF Superior Products | Freight Delivery — Colorado's Most Trusted Carrier";
const SITE_DESCRIPTION =
  "Colorado's most trusted freight delivery company. Same-day and next-day dispatch across Denver and beyond — professional drivers, transparent rates, and white-glove service.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mfsuperiorproducts.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: LOGO_URL,
    shortcut: LOGO_URL,
    apple: LOGO_URL,
  },
  openGraph: {
    type: "website",
    url: "https://mfsuperiorproducts.com",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: LOGO_URL,
        alt: "MF Superior Products logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [LOGO_URL],
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
