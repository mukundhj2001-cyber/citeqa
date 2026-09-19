import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Transformers.js / onnxruntime out of the webpack graph (Node runtime only).
  serverExternalPackages: ["@xenova/transformers"],
};

export default nextConfig;
