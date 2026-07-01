#!/usr/bin/env bash
# 检查 prisma/schema.prisma 是否为 postgresql，防止误提交 sqlite 版本
if grep -q 'provider = "sqlite"' prisma/schema.prisma; then
  echo "❌ 错误: prisma/schema.prisma 是 sqlite，部署到 Vercel 会失败"
  echo "   请先运行: bash scripts/dev-switch-db.sh postgres"
  echo "   然后再 commit"
  exit 1
fi
echo "✓ schema.prisma 是 postgresql，可以提交"
