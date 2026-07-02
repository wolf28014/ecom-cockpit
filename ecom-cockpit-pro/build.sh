#!/bin/bash
# ============================================================
# 电商经营驾驶舱 Pro - Windows 打包脚本
# ============================================================
# 用法（在 Windows 上）:
#   1. 安装 Python 3.10+
#   2. pip install -r requirements.txt
#   3. 双击运行 build.bat 或在 PowerShell 执行 ./build.sh
# ============================================================

set -e

echo "[1/4] 检查 Python 环境..."
python --version
pip --version

echo ""
echo "[2/4] 安装依赖..."
pip install -r requirements.txt

echo ""
echo "[3/4] 清理旧构建..."
rm -rf build dist

echo ""
echo "[4/4] 执行 PyInstaller 打包..."
pyinstaller build.spec

echo ""
echo "=========================================="
echo "✅ 打包完成！"
echo "=========================================="
echo ""
echo "产物路径: dist/电商经营驾驶舱Pro/"
echo "可执行文件: dist/电商经营驾驶舱Pro/电商经营驾驶舱Pro.exe"
echo ""
echo "首次启动会自动创建演示数据（3 个店铺、12 个 SKU、90 天数据）"
