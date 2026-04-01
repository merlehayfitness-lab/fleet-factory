import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agency-factory/core", "@agency-factory/runtime"],
  serverExternalPackages: ["node-ssh", "ssh2", "cpu-features"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native .node binaries and ssh2/node-ssh from server bundle
      // These are server-only deps pulled in via @agency-factory/core/vps/ssh-client
      config.externals = config.externals || [];
      config.externals.push("ssh2", "node-ssh", "cpu-features");
    }
    return config;
  },
};

export default nextConfig;
