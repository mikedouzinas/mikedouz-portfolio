import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image configuration for Next.js 16
  // Professional comment: Configure image optimization settings for Next.js 16
  // This ensures proper handling of local images from the public folder
  images: {
    // Allow local images from public folder
    // Professional comment: In Next.js 16, we may need explicit configuration for image optimization
    // Setting minimumCacheTTL to maintain reasonable caching behavior
    minimumCacheTTL: 60,
    // Enable unoptimized mode if needed for development (can be removed in production)
    // Professional comment: Uncomment if images still don't load - this disables optimization but ensures images work
    // unoptimized: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
