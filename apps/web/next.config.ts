import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (one level up from apps/web)
config({ path: resolve(__dirname, "../../.env.local") });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
