/**
 * @file next.config.js
 * @description Next.js configuration for the Beleqet Jobs platform.
 *
 * Image optimisation:
 * - Images are served unoptimized and no remote image hosts are allowed (see `images`).
 * - Mobile-first: `deviceSizes` starts at 320px (small phones).
 * - Lazy loading is enabled by default; `loading="eager"` must be
 *   explicitly set for above-the-fold images.
 */

/** Admin lives in its own app (frontend/), on its own address, so admin sessions stay off this site. */
const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.beleqetjobs.com").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A separate folder lets a verification build run beside `next dev` without
  // the two overwriting each other's files.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@beleqet/common"],
  images: {
    // The image optimizer of Next.js 14 has critical flaws (remote code execution from crafted
    // SVG/AVIF files) with no 14.x fix. The site only shows its own logo through next/image, so
    // images are served as they are and the optimizer fetches nothing from other websites.
    // Remove both settings after upgrading to a fixed Next.js (15.5.24+).
    unoptimized: true,
    remotePatterns: [],
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
      { source: '/admin', destination: `${ADMIN_URL}/dashboard`, permanent: false },
      { source: '/admin/:path*', destination: `${ADMIN_URL}/:path*`, permanent: false },
    ];
  },
};

module.exports = nextConfig;