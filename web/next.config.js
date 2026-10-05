/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [{ source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` }];
  },
};

module.exports = nextConfig;
