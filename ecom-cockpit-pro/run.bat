@echo off
chcp 65001 > nul
REM ============================================================
REM 电商经营驾驶舱 Pro - 直接运行（无需打包）
REM ============================================================

echo.
echo ============================================================
echo  电商经营驾驶舱 Pro - 直接运行
echo ============================================================
echo.

echo [1/3] 检查 Python 环境...
python --version
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 Python，请先安装 Python 3.10+
    echo 下载地址: https://www.python.org/downloads/
    echo 安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] 检查依赖包（首次运行需要约 2 分钟安装）...
pip install -r requirements.txt

echo.
echo [3/3] 启动应用...
echo.
python main.py

pause
