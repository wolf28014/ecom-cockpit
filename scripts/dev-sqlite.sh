#!/usr/bin/env bash
# 本地开发用 SQLite 启动（不影响 git 仓库的 postgres schema）
# 用法: bash scripts/dev-sqlite.sh

set -e
cd "$(dirname "$0")/.."

SCHEMA_FILE="prisma/schema.prisma"
BACKUP_FILE="prisma/schema.prisma.postgres.bak"

# 备份 postgres 版本
if grep -q 'provider = "postgresql"' "$SCHEMA_FILE"; then
  cp "$SCHEMA_FILE" "$BACKUP_FILE"
  sed -i 's|provider = "postgresql"|provider = "sqlite"|' "$SCHEMA_FILE"
  echo "✓ schema 切到 sqlite（postgres 版本已备份到 $BACKUP_FILE）"
elif grep -q 'provider = "sqlite"' "$SCHEMA_FILE"; then
  echo "✓ schema 已经是 sqlite"
fi

# 配置 .env
echo 'DATABASE_URL=file:/home/z/my-project/db/custom.db' > .env
echo "✓ .env 已配置 SQLite"

# 推送 schema 并 seed（如果数据库为空）
echo ""
echo "推送 schema..."
bun run db:push

# 检查是否需要 seed
NEED_SEED=$(bun -e "
import { db } from './src/lib/db'
const c = await db.store.count()
console.log(c)
await db.\$disconnect()
" 2>/dev/null || echo "0")

if [ "$NEED_SEED" = "0" ]; then
  echo "写入演示数据..."
  bun scripts/seed.ts
fi

# 启动 dev server
echo ""
echo "🚀 启动开发服务器..."
echo "访问: http://localhost:3000"
exec bun run dev

# 让 git 忽略本地的 schema 修改
git update-index --skip-worktree prisma/schema.prisma 2>/dev/null || true
git update-index --skip-worktree .env 2>/dev/null || true
echo "✓ git 已忽略 schema.prisma 和 .env 的本地修改"
