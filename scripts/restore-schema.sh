#!/usr/bin/env bash
# 恢复 schema.prisma 到 postgres 版本（提交代码前运行）
# 用法: bash scripts/restore-schema.sh

set -e
cd "$(dirname "$0")/.."

BACKUP_FILE="prisma/schema.prisma.postgres.bak"
SCHEMA_FILE="prisma/schema.prisma"

if [ -f "$BACKUP_FILE" ]; then
  cp "$BACKUP_FILE" "$SCHEMA_FILE"
  rm "$BACKUP_FILE"
  echo "✓ schema.prisma 已恢复为 postgresql"
else
  # 直接 sed 替换
  sed -i 's|provider = "sqlite"|provider = "postgresql"|' "$SCHEMA_FILE"
  echo "✓ schema.prisma 已切到 postgresql（无备份文件，直接 sed）"
fi

grep "provider" "$SCHEMA_FILE" | head -3

# 让 git 重新跟踪 schema
git update-index --no-skip-worktree prisma/schema.prisma 2>/dev/null || true
echo "✓ git 重新跟踪 schema.prisma"
