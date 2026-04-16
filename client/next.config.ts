import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js/Turborepo does NOT traverse up past
  // this directory when resolving node_modules (fixes "C:\node_modules doesn't exist")
  outputFileTracingRoot: path.join(__dirname),
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "fish-market",
  project: "client",
});
