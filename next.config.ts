import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server actions are origin-locked by Next 14+. The deployment has
  // 5 aliases (custom domain, vercel.app subdomain, branch alias, etc).
  // Any button click on /admin or /leads that goes to a server action
  // from one of these origins must match the allowlist or Next blocks
  // the POST as "cross-origin request not allowed" — appears in the
  // console as a CORS error.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "mfsuperiorproducts.com",
        "www.mfsuperiorproducts.com",
        "mfsuperior-crm.vercel.app",
        "mfsuperior-crm-tylerdevries22s-projects.vercel.app",
        "mfsuperior-crm-git-main-tylerdevries22s-projects.vercel.app",
        // PR preview aliases follow a pattern; wildcards are supported
        // since Next 14.2 in this option.
        "*.vercel.app",
      ],
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/**", search: "" },
    ],
  },
  async headers() {
    return [
      // Long-cache static video + poster assets. These are content-stable
      // (re-encodes change file names if needed), so the browser can keep
      // them forever and skip revalidation on repeat visits.
      {
        source: "/videos/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Public API endpoints that may be hit from email clients (Gmail
      // image proxy, etc.) or third-party form integrations. Explicit
      // CORS headers prevent any future cross-origin embeds from
      // failing the preflight.
      {
        source: "/api/contact",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
      {
        source: "/api/track/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
      {
        source: "/api/unsubscribe/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;
