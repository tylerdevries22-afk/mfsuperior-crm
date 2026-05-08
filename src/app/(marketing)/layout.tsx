import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://mfsuperiorproducts.com"),
  title: "MF Superior Solutions | Freight Delivery — Colorado's Most Trusted Carrier",
  description:
    "Colorado's most trusted freight delivery company. Same-day and next-day dispatch across Denver and beyond — professional drivers, transparent rates, and white-glove service.",
  icons: {
    icon: [
      { url: "/seo/favicon.ico" },
      { url: "/seo/favicon.svg", type: "image/svg+xml" },
      { url: "/seo/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: { url: "/seo/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    images: [{ url: "/seo/social-image.webp", width: 1600, height: 960 }],
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
