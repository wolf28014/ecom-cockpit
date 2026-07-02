"""
电商经营驾驶舱 Pro - 主入口
================================
启动方式:
    python main.py

打包方式（Windows）:
    pyinstaller build.spec
"""
import sys
import os
from pathlib import Path

# 确保能找到 app 包
sys.path.insert(0, str(Path(__file__).resolve().parent))

# 高 DPI 支持（必须在 QApplication 之前设置）
os.environ["QT_AUTO_SCREEN_SCALE_FACTOR"] = "1"

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from app.app_bootstrap import bootstrap_application


def main():
    # 创建应用
    app = QApplication(sys.argv)
    app.setApplicationName("电商经营驾驶舱 Pro")
    app.setApplicationVersion("1.0.0")

    # 高 DPI 缩放
    app.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    app.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    # 全局字体（苹方风格）
    font = QFont("PingFang SC", 10)
    font.setStyleStrategy(QFont.PreferAntialias)
    app.setFont(font)

    # 启动引导（初始化数据库、主题等）
    bootstrap_application(app)

    # 启动主窗口
    from app.ui.main_window import MainWindow
    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
