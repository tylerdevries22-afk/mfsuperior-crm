import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/**", search: "" },
    ],
  },
  async headers() {
    // Long-cache static video + poster assets. These are content-stable
    // (re-encodes change file names if needed), so the browser can keep
    // them forever and skip revalidation on repeat visits.
    return [
      {
        source: "/videos/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
