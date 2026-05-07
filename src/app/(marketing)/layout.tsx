import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MF Superior Products | Freight Box Trucks — Colorado's Premier Fleet Source",
  description:
    "Denver's most trusted source for freight box trucks. 16ft to 26ft, same-day availability, fast financing, and white-glove delivery across Colorado.",
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
