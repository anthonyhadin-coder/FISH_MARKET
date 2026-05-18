import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js/Turborepo does NOT traverse up past
  // this directory when resolving node_modules (fixes "C:\node_modules doesn't exist")
  outputFileTracingRoot: path.join(__dirname, '../../'),
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  transpilePackages: ["@fishmarket/shared-types"],
  turbopack: {
    root: path.join(__dirname, '../../'),
  },
  experimental: {},
  // ── Web Worker bundling ────────────────────────────────────────────
  // Enables `new Worker(new URL('./worker/nlpWorker.ts', import.meta.url))`
  // in Next.js pages / hooks. The worker is bundled separately and
  // served as a standalone JS file — it never appears in the main bundle.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.output = {
        ...config.output,
        globalObject: 'globalThis',
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' http://localhost:5000 https://* https://accounts.google.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "fish-market",
  project: "client",
});
