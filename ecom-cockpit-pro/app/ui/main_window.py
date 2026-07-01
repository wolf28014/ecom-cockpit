"""
主窗口 + 侧边导航
"""
from typing import Dict, Optional
from PySide6.QtCore import Qt, QSize, Signal
from PySide6.QtGui import QIcon, QAction
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QLabel,
    QStackedWidget, QFrame, QSizePolicy, QPushButton
)
from qfluentwidgets import (
    NavigationInterface, FluentIcon as FIF, NavigationItemPosition,
    Theme, setTheme, setThemeColor
)

from app.config import APP_NAME, APP_VERSION
from app.database.connection import get_session
from app.core.analytics import AnalyticsService
from app.core.alerts import AlertService


class MainWindow(QMainWindow):
    """主窗口"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_NAME} v{APP_VERSION}")
        self.resize(1440, 900)
        self.setMinimumSize(1200, 750)

        # 应用主题色
        setThemeColor("#0071E3")

        # 创建中心部件
        central = QWidget()
        central.setObjectName("rootWidget")
        self.setCentralWidget(central)

        main_layout = QHBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 左侧导航
        self.nav = NavigationInterface(self, showReturnButton=False)
        self.nav.setExpandWidth(220)
        main_layout.addWidget(self.nav)

        # 右侧内容栈
        self.stack = QStackedWidget()
        self.stack.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        main_layout.addWidget(self.stack)

        # 初始化页面（懒加载，但全部注册）
        self._pages: Dict[str, QWidget] = {}
        self._init_pages()

        # 顶部状态栏
        self._init_status_bar()

        # 默认显示首页
        self.switch_to("dashboard")

    def _init_pages(self):
        """初始化所有页面"""
        from app.ui.pages.dashboard_page import DashboardPage
        from app.ui.pages.stores_page import StoresPage
        from app.ui.pages.data_entry_page import DataEntryPage
        from app.ui.pages.data_import_page import DataImportPage
        from app.ui.pages.analytics_page import AnalyticsPage
        from app.ui.pages.ai_center_page import AICenterPage
        from app.ui.pages.profit_target_page import ProfitTargetPage
        from app.ui.pages.cashflow_page import CashFlowPage
        from app.ui.pages.sku_page import SKUPage
        from app.ui.pages.reports_page import ReportsPage
        from app.ui.pages.settings_page import SettingsPage
        from app.ui.pages.backup_page import BackupPage

        pages = [
            ("dashboard", "首页驾驶舱", FIF.HOME, DashboardPage()),
            ("stores", "多店铺管理", FIF.PEOPLE, StoresPage()),
            ("data_entry", "数据录入", FIF.EDIT, DataEntryPage()),
            ("data_import", "数据导入", FIF.FOLDER, DataImportPage()),
            ("analytics", "经营分析", FIF.IOT, AnalyticsPage()),
            ("ai_center", "AI 经营中心", FIF.ROBOT, AICenterPage()),
            ("profit_target", "利润目标", FIF.FLAG, ProfitTargetPage()),
            ("cashflow", "现金流预测", FIF.MARKET, CashFlowPage()),
            ("sku", "SKU 分析", FIF.TAG, SKUPage()),
            ("reports", "报表中心", FIF.DOCUMENT, ReportsPage()),
            ("settings", "系统设置", FIF.SETTING, SettingsPage(), NavigationItemPosition.BOTTOM),
            ("backup", "数据备份", FIF.SAVE, BackupPage(), NavigationItemPosition.BOTTOM),
        ]

        for item in pages:
            if len(item) == 4:
                key, label, icon, page = item
                position = NavigationItemPosition.TOP
            else:
                key, label, icon, page, position = item

            self._pages[key] = page
            self.stack.addWidget(page)
            self.nav.addItem(
                routeKey=key,
                icon=icon,
                text=label,
                onClick=lambda k=key: self.switch_to(k),
                position=position,
            )

    def _init_status_bar(self):
        """状态栏"""
        status = self.statusBar()
        status.showMessage("就绪")
        status.setStyleSheet("QStatusBar { background: #F5F5F7; color: #6E6E73; }")

        # 预警数显示
        self.alert_label = QLabel("● 0 预警")
        self.alert_label.setStyleSheet("color: #34C759; padding: 0 12px;")
        status.addPermanentWidget(self.alert_label)

        self._refresh_alert_count()

    def _refresh_alert_count(self):
        """刷新预警数"""
        try:
            with get_session() as session:
                svc = AlertService(session)
                alerts = svc.get_alerts(unread_only=True, limit=100)
                count = len(alerts)
                if count == 0:
                    self.alert_label.setText("● 0 预警")
                    self.alert_label.setStyleSheet("color: #34C759; padding: 0 12px;")
                elif count < 5:
                    self.alert_label.setText(f"● {count} 预警")
                    self.alert_label.setStyleSheet("color: #FF9500; padding: 0 12px;")
                else:
                    self.alert_label.setText(f"● {count} 预警")
                    self.alert_label.setStyleSheet("color: #FF3B30; padding: 0 12px;")
        except Exception as e:
            self.alert_label.setText("预警状态未知")
            self.alert_label.setStyleSheet("color: #8E8E93; padding: 0 12px;")

    def switch_to(self, key: str):
        """切换到指定页面"""
        if key in self._pages:
            page = self._pages[key]
            # 调用页面的 refresh 方法（如果存在）
            if hasattr(page, "refresh"):
                try:
                    page.refresh()
                except Exception as e:
                    print(f"[WARN] 刷新页面 {key} 失败: {e}")
            self.stack.setCurrentWidget(page)
            self.nav.setCurrentItem(key)
            self.statusBar().showMessage(f"当前: {page.__class__.__name__}")

    def closeEvent(self, event):
        """关闭事件"""
        try:
            # 触发页面保存数据
            for page in self._pages.values():
                if hasattr(page, "on_close"):
                    page.on_close()
        except Exception:
            pass
        super().closeEvent(event)
