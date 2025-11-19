/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  images: {
    domains: ['localhost'], // Restrict image domains for security
    formats: ['image/webp', 'image/avif'], // Optimize image formats
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Prevent clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevent MIME sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()', // Restrict permissions
          },
        ],
      },
    ];
  },
  // Enable experimental features for better security
  experimental: {
    optimizeCss: true, // Optimize CSS
  },
  // Configure build output
  output: 'standalone', // For containerized deployments
}

module.exports = nextConfig
