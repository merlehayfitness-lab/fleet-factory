import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agency-factory/core", "@agency-factory/runtime"],
};

export default nextConfig;
