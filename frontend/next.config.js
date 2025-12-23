/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone', // Enable standalone output for Docker
  // Add cache busting with build ID
  generateBuildId: async () => {
    // Use timestamp to force new build ID
    return `build-${Date.now()}`;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Use environment variable for API URL, fallback to backend service in Docker
        destination: process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
          : 'http://backend:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
