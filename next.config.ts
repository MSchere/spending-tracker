import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Type checking runs via `pnpm typecheck` on dev.
    // Skipped here because prisma generate cannot run on NixOS
    // (no precompiled engine binaries for linux-nixos).
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
