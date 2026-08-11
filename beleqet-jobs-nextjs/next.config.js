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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
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
};

module.exports = nextConfig;