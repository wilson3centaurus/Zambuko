/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', 'node-routeros'],
  },
  // Allow captive portal environments where DNS is not yet resolved
  async headers() {
    return [
      {
        source: '/(portal)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
