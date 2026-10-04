import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js dev badge so the app looks the same in development and in demos.
  devIndicators: false,
  // Deployed copies read the dataset from this committed snapshot (see lib/store.ts).
  outputFileTracingIncludes: {
    "/": ["./data/snapshot.json"],
    "/**": ["./data/snapshot.json"],
  },
};

export default nextConfig;
