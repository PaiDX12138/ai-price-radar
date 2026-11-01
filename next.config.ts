import type { NextConfig } from "next";

const lowMemoryBuild = process.env.RADAR_LOW_MEMORY_BUILD === "1";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    agentUpgrade: "security",
    ...(lowMemoryBuild ? {
      cpus: 1,
      staticGenerationMaxConcurrency: 1,
      webpackBuildWorker: true,
      webpackMemoryOptimizations: true,
    } : {}),
  },
  // Runtime archives and portable import data are not server dependencies.
  outputFileTracingExcludes: {
    "/*": ["./work/**/*", "./.git/**/*", "./data/transit/raw/**/*", "./data/transit-backups/**/*", "./config/transit-baseline/**/*"],
  },
  partialPrefetching: true,
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
