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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

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
          value: (() => {
              const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
              const apiUrl = rawApiUrl.replace(/\/+$/, '');
              const isAbsolute = /^https?:\/\//i.test(apiUrl);

              const apiCsp = isAbsolute
                ? `${apiUrl} ${apiUrl.replace(/^http:/, 'https:')}`
                : '';

              const wsCsp = isAbsolute
                ? `${apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}`
                : '';

              return `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${apiCsp}; connect-src 'self' ${apiCsp} ${wsCsp} http://localhost:5000 ws://localhost:5000 https://localhost:5000 wss://localhost:5000; font-src 'self' data: https:;`;
            })(),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    const apiUrl = rawApiUrl.replace(/\/+$/, '');
    const isAbsoluteApiUrl = /^https?:\/\//i.test(apiUrl);
    const rewrites = [];

    // Evita loop quando NEXT_PUBLIC_API_URL = "/api".
    // Nesse cenário, o proxy da borda (nginx) já resolve /api para o backend.
    if (isAbsoluteApiUrl) {
      const apiBase = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      rewrites.push({
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      });

      rewrites.push({
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      });
    } else if (apiUrl && apiUrl !== '/api') {
      rewrites.push({
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      });

      rewrites.push({
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      });
    }

    return rewrites;
  },
  // Enable experimental features for better security
  experimental: {
    optimizeCss: true, // Optimize CSS
    workerThreads: true,
  },
  // Configure build output
  output: 'standalone', // Always use standalone for SSR support
  // Transpile local module packages
  // transpilePackages: ['@modules/sistema'],
}

export default nextConfig
