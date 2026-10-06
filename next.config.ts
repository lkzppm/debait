import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // vgpu WGSL shaders imported as typed modules (src/wgsl-env.d.ts).
  turbopack: {
    rules: {
      "*.wgsl": { loaders: ["@vgpu/wgsl/loader-webpack"], as: "*.js" },
    },
  },
  webpack(config) {
    config.module.rules.push({ test: /\.wgsl$/, loader: "@vgpu/wgsl/loader-webpack" });
    return config;
  },
};

export default nextConfig;
