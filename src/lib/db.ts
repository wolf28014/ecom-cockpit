import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 创建 Prisma 客户端
// - 生产环境（Vercel）：不打印 query 日志，避免 Serverless 函数日志爆炸
// - 开发环境：打印 query 日志，便于调试
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

// 在开发环境复用全局 Prisma 实例，避免 HMR 时频繁创建连接
// 在 Vercel Serverless 环境下，每个函数实例也会复用全局实例
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
