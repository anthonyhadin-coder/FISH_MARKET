import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js/Turborepo does NOT traverse up past
  // this directory when resolving node_modules (fixes "C:\node_modules doesn't exist")
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // @ts-ignore - Next.js types might not fully recognize turbo in this version
    turbo: {
      resolveAlias: {
        '@': './src'
      }
    }
  },
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
