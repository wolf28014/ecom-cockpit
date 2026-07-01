import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 部署不需要 standalone，使用默认构建
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  // 兼容 Prisma 在 Vercel Edge Runtime / Serverless 环境
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  },
};

export default nextConfig;
