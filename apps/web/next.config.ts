import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (one level up from apps/web)
// Only in development - on Vercel, env vars are set via dashboard
if (process.env.NODE_ENV !== "production") {
  try {
    config({ path: resolve(__dirname, "../../.env.local") });
  } catch (error) {
    // .env.local might not exist, that's ok
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
