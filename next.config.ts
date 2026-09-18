import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Principe I : aucune donnée personnelle ne doit fuiter par un en-tête.
  poweredByHeader: false,
};

export default nextConfig;
