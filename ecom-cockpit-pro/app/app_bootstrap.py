"""
应用启动引导：初始化数据库、主题、演示数据
"""
from PySide6.QtWidgets import QApplication

from app.config import DB_URL
from app.database.connection import init_db, get_session
from app.database.seed import seed_demo_data_if_empty


def bootstrap_application(app: QApplication):
    """应用启动引导"""
    # 1. 初始化数据库
    init_db(DB_URL)

    # 2. 如果数据库为空，自动写入演示数据
    with get_session() as session:
        seed_demo_data_if_empty(session)

    # 3. 应用 Fluent 主题
    _apply_theme(app)


def _apply_theme(app: QApplication):
    """应用 Apple Numbers 风主题"""
    from qfluentwidgets import Theme, setTheme
    setTheme(Theme.LIGHT)
