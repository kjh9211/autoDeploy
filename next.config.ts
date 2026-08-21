import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pm2's CLI/daemon-client code has dynamic requires and an optional
  // terminal UI (blessed) that the bundler can't statically analyze —
  // load it via native require instead of bundling it.
  serverExternalPackages: ["pm2", "mariadb"],
};

export default nextConfig;
