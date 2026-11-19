/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Admin pages are never framed, indexed or cached by proxies.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async redirects() {
    // Bookmarks from the old admin app (/admin/users, /admin/dashboard, ...).
    return [
      { source: '/admin', destination: '/dashboard', permanent: true },
      { source: '/admin/fraud-alerts/:path*', destination: '/fraud', permanent: true },
      { source: '/admin/manual-payments', destination: '/payments', permanent: true },
      { source: '/admin/jobs', destination: '/listings', permanent: true },
      { source: '/admin/audit-logs', destination: '/audit', permanent: true },
      { source: '/admin/logs', destination: '/audit', permanent: true },
      { source: '/admin/email', destination: '/emails', permanent: true },
      { source: '/admin/:path*', destination: '/:path*', permanent: true },
    ];
  },
};

module.exports = nextConfig;
