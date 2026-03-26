/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: process.env.NEXT_PUBLIC_IS_GH_PAGES === "true",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: (() => {
              const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
              const apiUrl = rawApiUrl.replace(/\/+$/, "");
              const isAbsolute = /^https?:\/\//i.test(apiUrl);

              const apiCsp = isAbsolute
                ? `${apiUrl} ${apiUrl.replace(/^http:/, "https:")}`
                : "";

              const wsCsp = isAbsolute
                ? `${apiUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}`
                : "";

              return `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${apiCsp}; connect-src 'self' ${apiCsp} ${wsCsp} http://localhost:5000 ws://localhost:5000 https://localhost:5000 wss://localhost:5000; font-src 'self' data: https:;`;
            })(),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
    const apiUrl = rawApiUrl.replace(/\/+$/, "");
    const isAbsoluteApiUrl = /^https?:\/\//i.test(apiUrl);
    const rewrites = [];

    if (isAbsoluteApiUrl) {
      const apiBase = apiUrl.endsWith("/api") ? apiUrl : `${apiUrl}/api`;

      rewrites.push({
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      });

      rewrites.push({
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      });
    } else if (apiUrl && apiUrl !== "/api") {
      rewrites.push({
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      });

      rewrites.push({
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      });
    }

    return rewrites;
  },
  typescript: {
    // O Next usa este arquivo proprio para seus ajustes automaticos de tipos gerados.
    // O typecheck canonico do projeto continua em tsconfig.json.
    tsconfigPath: "./tsconfig.next.json",
  },
  experimental: {
    optimizeCss: true,
    // Mantido desabilitado para evitar falha estrutural do build no ambiente atual.
    workerThreads: false,
    webpackBuildWorker: false,
  },
  output: "standalone",
  staticPageGenerationTimeout: 1000,
};

export default nextConfig;
