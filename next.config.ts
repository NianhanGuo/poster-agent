import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  turbopack: {},
};

export default nextConfig;
