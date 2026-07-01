# ============================================================
# 电商经营驾驶舱 Pro - PowerShell 运行脚本
# ============================================================
# 用法：右键此文件 → "使用 PowerShell 运行"
# 或在 PowerShell 中执行：.\run.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 电商经营驾驶舱 Pro - 启动器" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python
Write-Host "[1/3] 检查 Python 环境..." -ForegroundColor Yellow
try {
    $pyVersion = python --version 2>&1
    Write-Host "  Python 版本: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[错误] 未检测到 Python，请先安装 Python 3.10+" -ForegroundColor Red
    Write-Host "下载地址: https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "安装时请勾选 'Add Python to PATH'" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 安装依赖
Write-Host ""
Write-Host "[2/3] 检查依赖包（首次运行需要约 2 分钟安装）..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 依赖安装失败" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 启动应用
Write-Host ""
Write-Host "[3/3] 启动应用..." -ForegroundColor Yellow
Write-Host ""
python main.py

Read-Host "按回车键退出"
