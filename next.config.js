/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/login',
        destination: '/auth/login',
      },
      {
        source: '/signup',
        destination: '/auth/signup',
      },
      // Add other rewrites if needed
    ]
  },
  // Other Next.js config options can go here
};

module.exports = nextConfig; 