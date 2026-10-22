import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // The card package ships TypeScript source; Next compiles it.
  transpilePackages: ["@one-of-one/card", "@one-of-one/places"],
};

export default nextConfig;
