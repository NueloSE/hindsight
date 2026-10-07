import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Market data snapshots are read from disk at runtime; make sure they ship with every server route.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*", "./assets/**/*"],
  },
};

export default nextConfig;
