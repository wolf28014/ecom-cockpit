@echo off
chcp 65001 > nul
REM ============================================================
REM 电商经营驾驶舱 Pro - Windows 一键打包脚本
REM ============================================================

echo.
echo ============================================================
echo  电商经营驾驶舱 Pro - 打包工具
echo ============================================================
echo.

echo [1/5] 检查 Python 环境...
python --version
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 Python，请先安装 Python 3.10+
    echo 下载地址: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
pip --version

echo.
echo [2/5] 安装依赖包...
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败，请检查网络或 pip 配置
    pause
    exit /b 1
)

echo.
echo [3/5] 安装 PyInstaller...
pip install pyinstaller

echo.
echo [4/5] 清理旧构建...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo.
echo [5/5] 执行 PyInstaller 打包（耗时约 3-5 分钟，请耐心等待）...
pyinstaller build.spec
if errorlevel 1 (
    echo.
    echo [错误] 打包失败，请查看上方错误信息
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  打包完成！
echo ============================================================
echo.
echo 产物路径: dist\电商经营驾驶舱Pro\
echo 可执行文件: dist\电商经营驾驶舱Pro\电商经营驾驶舱Pro.exe
echo.
echo 首次启动会自动创建演示数据（3 个店铺、12 个 SKU、90 天数据）
echo.
pause
