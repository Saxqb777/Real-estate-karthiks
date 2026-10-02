import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets parallel local dev servers use separate build folders (NEXT_DIST_DIR=.next-<name>).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
