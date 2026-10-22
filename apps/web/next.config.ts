import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let a phone on the same Wi-Fi load the dev server by LAN address or Bonjour name.
  // Next 16 blocks non-localhost origins otherwise, and the page then never hydrates (no taps work).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  reactStrictMode: true,
  devIndicators: false,
  // The card package ships TypeScript source; Next compiles it.
  transpilePackages: ["@one-of-one/card", "@one-of-one/places"],
};

export default nextConfig;
