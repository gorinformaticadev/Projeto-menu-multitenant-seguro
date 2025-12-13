/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Desabilitado temporariamente para evitar rate limiting
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  images: {
    domains: ['localhost'], // Restrict image domains for security
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
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${apiUrl}; connect-src 'self' ${apiUrl} ${apiUrl.replace('http', 'ws')} http://localhost:5000 ws://localhost:5000; font-src 'self' data: https:;`,
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
