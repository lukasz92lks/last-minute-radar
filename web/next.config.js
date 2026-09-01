/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxy /api/* to the Express backend so the browser talks to one origin
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
