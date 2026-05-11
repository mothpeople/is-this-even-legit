import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // Disables PWA caching while you are testing locally
});

const nextConfig: NextConfig = {
  // If you had any existing rules in your config, keep them inside this object!
};

export default withPWA(nextConfig);