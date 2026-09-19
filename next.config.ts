import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Transformers.js / onnxruntime / pdf-parse out of the webpack graph (Node runtime only).
  serverExternalPackages: ["@xenova/transformers", "pdf-parse"],
};

export default nextConfig;
