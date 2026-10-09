/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ["beleqetjobs.com"],
  }
};

module.exports = nextConfig;
