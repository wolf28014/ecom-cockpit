"""
现金流预测页
"""
from datetime import date
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox, QTabWidget,
    QWidget, QTextEdit, QSpinBox, QFrame, QMessageBox, QSizePolicy
)
from PySide6.QtCore import Qt, QThread, Signal

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.ui.components.kpi_card import KPICard, KPICardRow
from app.ui.components.chart_view import ChartView
from app.database.connection import get_session
from app.database.models import Store
from app.core.forecast import ForecastService
from app.core.ai_service import AIService
from app.core.analytics import AnalyticsService


class AICashflowTask(QThread):
    finished = Signal(str)
    error = Signal(str)

    def __init__(self, store_id: int, days: int):
        super().__init__()
        self.store_id = store_id
        self.days = days

    def run(self):
        try:
            with get_session() as session:
                svc = AIService(session)
                result = svc.predict_cashflow(self.store_id, self.days)
                self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))


class AISimulateTask(QThread):
    finished = Signal(str)
    error = Signal(str)

    def __init__(self, store_id: int, scenario: str):
        super().__init__()
        self.store_id = store_id
        self.scenario = scenario

    def run(self):
        try:
            with get_session() as session:
                svc = AIService(session)
                result = svc.simulate_scenario(self.store_id, self.scenario)
                self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))


class CashFlowPage(BasePage):
    title = "现金流预测"
    subtitle = "7 天 / 30 天 / 90 天 预测 + AI 经营模拟"

    def __init__(self):
        super().__init__()
        self.current_store_id = 0
        self._ai_task: Optional[QThread] = None

        # 顶部
        toolbar = QHBoxLayout()
        toolbar.addWidget(QLabel("选择店铺:"))
        self.store_combo = QComboBox()
        self.store_combo.setMinimumWidth(220)
        self.store_combo.currentIndexChanged.connect(lambda _: self.refresh())
        toolbar.addWidget(self.store_combo)
        toolbar.addStretch()
        self.add_layout(toolbar)

        # Tab
        self.tabs = QTabWidget()
        self.tab_7 = QWidget()
        self.tab_30 = QWidget()
        self.tab_90 = QWidget()
        self.tab_sim = QWidget()
        self.tabs.addTab(self.tab_7, "未来 7 天")
        self.tabs.addTab(self.tab_30, "未来 30 天")
        self.tabs.addTab(self.tab_90, "未来 90 天")
        self.tabs.addTab(self.tab_sim, "AI 经营模拟")
        self._init_forecast_tab(self.tab_7, 7)
        self._init_forecast_tab(self.tab_30, 30)
        self._init_forecast_tab(self.tab_90, 90)
        self._init_simulate_tab()
        self.add_widget(self.tabs)
        self.add_stretch()

        self._load_stores()

    def _init_forecast_tab(self, tab: QWidget, days: int):
        layout = QVBoxLayout(tab)
        layout.setSpacing(12)

        # KPI 行
        kpi_row = KPICardRow()
        layout.addWidget(kpi_row)

        # 趋势图
        chart_section = SectionCard(f"未来 {days} 天预测趋势", "基于近 30 天日均数据预测")
        chart = ChartView(height=320)
        chart_section.add_widget(chart)
        layout.addWidget(chart_section)

        # AI 建议
        ai_section = SectionCard("AI 现金流分析", "GLM-4 智能分析预测结果")
        ai_btn_layout = QHBoxLayout()
        ai_btn_layout.addStretch()
        predict_btn = QPushButton("生成 AI 分析")
        predict_btn.setObjectName("PrimaryButton")
        predict_btn.clicked.connect(lambda: self._on_predict(days))
        ai_btn_layout.addWidget(predict_btn)
        ai_section.add_layout(ai_btn_layout)

        result_label = QLabel("点击「生成 AI 分析」按钮，GLM-4 将基于预测结果给出建议")
        result_label.setWordWrap(True)
        result_label.setStyleSheet("""
            QLabel {
                background: #FFFFFF; border: 1px solid #E5E5EA;
                border-radius: 8px; padding: 16px;
                font-size: 13px; color: #1D1D1F;
            }
        """)
        result_label.setMinimumHeight(180)
        result_label.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        ai_section.add_widget(result_label)
        layout.addWidget(ai_section)

        # 保存引用
        if not hasattr(self, "_forecast_kpi_rows"):
            self._forecast_kpi_rows = {}
            self._forecast_charts = {}
            self._forecast_results = {}
        self._forecast_kpi_rows[days] = kpi_row
        self._forecast_charts[days] = chart
        self._forecast_results[days] = result_label

    def _init_simulate_tab(self):
        layout = QVBoxLayout(self.tab_sim)
        layout.setSpacing(12)

        # 场景选择
        scene_section = SectionCard("情景模拟", "选择或自定义一个经营假设，让 AI 帮你预测影响")
        scene_layout = QHBoxLayout()

        self.scene_combo = QComboBox()
        scenes = [
            "如果推广增加 20%",
            "如果推广减少 20%",
            "如果客单价提升 10%",
            "如果退款率降低到 3%",
            "如果新增一个爆款",
            "如果停售底部 3 个 SKU",
        ]
        for s in scenes:
            self.scene_combo.addItem(s)
        scene_layout.addWidget(self.scene_combo)

        sim_btn = QPushButton("开始模拟")
        sim_btn.setObjectName("PrimaryButton")
        sim_btn.clicked.connect(self._on_simulate)
        scene_layout.addWidget(sim_btn)

        scene_section.add_layout(scene_layout)
        layout.addWidget(scene_section)

        # 结果
        result_section = SectionCard("模拟结果", "AI 基于当前数据预测变化")
        self.sim_result = QLabel("选择情景后点击「开始模拟」，GLM-4 将预测销售、利润变化并给出建议")
        self.sim_result.setWordWrap(True)
        self.sim_result.setStyleSheet("""
            QLabel {
                background: #FFFFFF; border: 1px solid #E5E5EA;
                border-radius: 8px; padding: 16px;
                font-size: 13px; color: #1D1D1F;
            }
        """)
        self.sim_result.setMinimumHeight(400)
        self.sim_result.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        result_section.add_widget(self.sim_result)
        layout.addWidget(result_section)

    def _load_stores(self):
        self.store_combo.blockSignals(True)
        self.store_combo.clear()
        self.store_combo.addItem("全店铺汇总", 0)
        with get_session() as session:
            stores = list(session.query(Store).filter(Store.is_active == True).order_by(Store.id).all())
            for s in stores:
                self.store_combo.addItem(s.name, s.id)
        self.store_combo.blockSignals(False)

    def refresh(self):
        self._load_stores()
        self.current_store_id = self.store_combo.currentData() or 0

        try:
            with get_session() as session:
                svc = ForecastService(session)
                for days in [7, 30, 90]:
                    forecast = svc.forecast(self.current_store_id, days)

                    # KPI 卡片
                    kpi_row = self._forecast_kpi_rows[days]
                    while kpi_row.layout().count():
                        item = kpi_row.layout().takeAt(0)
                        if item.widget():
                            item.widget().deleteLater()

                    risk_color = {"safe": "#34C759", "warning": "#FF9500", "danger": "#FF3B30"}[forecast.risk_level]
                    risk_label = {"safe": "安全", "warning": "需关注", "danger": "高风险"}[forecast.risk_level]

                    for c in [
                        KPICard(f"预计销售", f"¥{forecast.projected_sales:,.0f}",
                                f"日均 ¥{forecast.avg_daily_sales:,.0f}", None, "", accent="#0071E3"),
                        KPICard(f"预计利润", f"¥{forecast.projected_profit:,.0f}",
                                f"日均 ¥{forecast.avg_daily_profit:,.0f}", None, "", accent="#34C759"),
                        KPICard(f"预计支出", f"¥{forecast.projected_cost:,.0f}",
                                f"日均 ¥{forecast.avg_daily_cost:,.0f}", None, "", accent="#FF9500"),
                        KPICard(f"预计余额", f"¥{forecast.projected_balance:,.0f}",
                                f"风险等级: {risk_label}", None, "", accent=risk_color),
                    ]:
                        kpi_row.layout().addWidget(c)

                    # 趋势图
                    chart = self._forecast_charts[days]
                    if forecast.daily_forecast:
                        x_data = [d["date"][5:] for d in forecast.daily_forecast]  # MM-DD
                        chart.show_line_chart(
                            f"未来 {days} 天预测趋势",
                            x_data=x_data,
                            series=[
                                {"name": "销售额", "data": [d["sales"] for d in forecast.daily_forecast], "color": "#0071E3"},
                                {"name": "净利润", "data": [d["profit"] for d in forecast.daily_forecast], "color": "#34C759"},
                            ],
                            area=True,
                        )

        except Exception as e:
            print(f"[ERROR] 现金流预测刷新失败: {e}")

    def _on_predict(self, days: int):
        if self._ai_task and self._ai_task.isRunning():
            QMessageBox.warning(self, "提示", "已有任务在执行")
            return

        self.current_store_id = self.store_combo.currentData() or 0
        self._forecast_results[days].setText("🤖 GLM-4 正在分析...")

        self._ai_task = AICashflowTask(self.current_store_id, days)
        self._ai_task.finished.connect(lambda r, d=days: self._on_predict_ready(d, r))
        self._ai_task.error.connect(lambda e, d=days: self._on_predict_error(d, e))
        self._ai_task.start()

    def _on_predict_ready(self, days: int, result: str):
        import re
        html = result
        html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', html)
        html = html.replace("\n", "<br>")
        self._forecast_results[days].setText(html)

    def _on_predict_error(self, days: int, err: str):
        self._forecast_results[days].setText(f"❌ 失败: {err}")

    def _on_simulate(self):
        if self._ai_task and self._ai_task.isRunning():
            QMessageBox.warning(self, "提示", "已有任务在执行")
            return

        scenario = self.scene_combo.currentText()
        self.current_store_id = self.store_combo.currentData() or 0
        self.sim_result.setText("🤖 GLM-4 正在模拟分析...")

        self._ai_task = AISimulateTask(self.current_store_id, scenario)
        self._ai_task.finished.connect(self._on_sim_ready)
        self._ai_task.error.connect(self._on_sim_error)
        self._ai_task.start()

    def _on_sim_ready(self, result: str):
        import re
        html = result
        html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', html)
        html = html.replace("\n", "<br>")
        self.sim_result.setText(html)

    def _on_sim_error(self, err: str):
        self.sim_result.setText(f"❌ 模拟失败: {err}")
