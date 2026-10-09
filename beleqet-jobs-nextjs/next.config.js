/**
 * @file next.config.js
 * @description Next.js configuration for the Beleqet Jobs platform.
 *
 * Image optimisation:
 * - Remote images are allowed from all HTTPS hosts.
 * - Mobile-first: `deviceSizes` starts at 320px (small phones).
 * - Lazy loading is enabled by default; `loading="eager"` must be
 *   explicitly set for above-the-fold images.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@beleqet/common"],
  images: {
    remotePatterns: [
      // Allow all HTTPS image sources (Unsplash, CDNs, user avatars, etc.)
      { protocol: "https", hostname: "**", pathname: "/**" },
    ],
    /**
     * Mobile-first device sizes for responsive `next/image`.
     * The smallest size (320) targets small phones; the largest
     * (1280) covers desktop monitors.
     */
    deviceSizes: [320, 375, 428, 640, 768, 1024, 1280],
    /**
     * Image sizes used for `sizes` prop optimisation.
     * These breakpoints match the Tailwind responsive tiers.
     */
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async redirects() {
    return [
      { source: '/user-dashboard', destination: '/dashboard', permanent: false },
      { source: '/user-dashboard/:path*', destination: '/dashboard/:path*', permanent: false },
      { source: '/joblists', destination: '/jobs', permanent: false },
      { source: '/joblists/:path*', destination: '/jobs/:path*', permanent: false },
      { source: '/my-applied', destination: '/applications', permanent: false },
      { source: '/my-applied/:path*', destination: '/applications/:path*', permanent: false },
      { source: '/submit-job', destination: '/post-job', permanent: false },
      { source: '/submit-job/:path*', destination: '/post-job/:path*', permanent: false },
      { source: '/applicants-jobs', destination: '/applications', permanent: false },
      { source: '/applicants-jobs/:path*', destination: '/applications/:path*', permanent: false },
      { source: '/my-jobs-2', destination: '/dashboard', permanent: false },
      { source: '/my-jobs-2/:path*', destination: '/dashboard/:path*', permanent: false },
    ];
  },
};

module.exports = nextConfig;