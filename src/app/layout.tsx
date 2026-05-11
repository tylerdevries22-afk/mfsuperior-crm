import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Shared brand mark across favicon, apple-touch, social-card previews,
// and the top header. The sidebar (src/components/nav/sidebar.tsx) and
// login screen (src/app/login/page.tsx) load the same file, so the
// browser-tab icon, the iOS home-screen icon, the link-preview card,
// and the in-app top-header logo are visually identical.
const LOGO_URL = "/logo.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://mfsuperiorproducts.com"),
  title: {
    default: "MF Superior · CRM",
    template: "%s · MF Superior",
  },
  description:
    "CRM and email automation for MF Superior Products freight box trucks.",
  icons: {
    icon: LOGO_URL,
    shortcut: LOGO_URL,
    apple: LOGO_URL,
  },
  openGraph: {
    type: "website",
    url: "https://mfsuperiorproducts.com",
    siteName: "MF Superior Products",
    title: "MF Superior · CRM",
    description:
      "CRM and email automation for MF Superior Products freight box trucks.",
    images: [{ url: LOGO_URL, alt: "MF Superior Products logo" }],
  },
  twitter: {
    card: "summary",
    title: "MF Superior · CRM",
    description:
      "CRM and email automation for MF Superior Products freight box trucks.",
    images: [LOGO_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "rounded-md border border-border bg-card text-card-foreground shadow-sm",
            },
          }}
        />
      </body>
    </html>
  );
}
