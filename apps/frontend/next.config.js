/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Desabilitado temporariamente para evitar rate limiting
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  images: {
    unoptimized: process.env.NEXT_PUBLIC_IS_GH_PAGES === 'true',
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
    formats: ['image/webp', 'image/avif'], // Optimize image formats
  },
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${apiUrl} ${apiUrl.replace('http', 'https')}; connect-src 'self' ${apiUrl} ${apiUrl.replace('http', 'ws')} ${apiUrl.replace('http', 'https')} ${apiUrl.replace('http', 'wss')} http://localhost:5000 ws://localhost:5000 https://localhost:5000 wss://localhost:5000; font-src 'self' data: https:;`,
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`, // Proxy API requests to backend
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`, // Proxy static uploads to backend
      },
    ];
  },
  // Enable experimental features for better security
  experimental: {
    optimizeCss: true, // Optimize CSS
  },
  // Configure build output
  output: 'standalone', // Always use standalone for SSR support
  // Transpile local module packages
  // transpilePackages: ['@modules/sistema'],
}

module.exports = nextConfig
