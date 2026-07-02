"""
首页驾驶舱页
"""
from datetime import date
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QComboBox, QPushButton, QFrame, QSizePolicy
)
from PySide6.QtCore import Qt

from app.ui.pages.base_page import BasePage
from app.ui.components.kpi_card import KPICard, KPICardRow
from app.ui.components.section_card import SectionCard
from app.ui.components.chart_view import ChartView
from app.database.connection import get_session
from app.core.analytics import AnalyticsService


class DashboardPage(BasePage):
    title = "首页驾驶舱"
    subtitle = "实时掌握经营全貌"

    def __init__(self):
        super().__init__()
        self.current_store_id = 0  # 0 = 全店铺

        # 顶部控制栏
        self._init_toolbar()

        # KPI 卡片行 - 今日
        self.today_row = KPICardRow()
        self.add_widget(self.today_row)

        # KPI 卡片行 - 周/月/年
        self.period_row = KPICardRow()
        self.add_widget(self.period_row)

        # 趋势图区
        trend_section = SectionCard("经营趋势", "近 30 天销售/利润/订单趋势")
        self.trend_chart = ChartView(height=320)
        trend_section.add_widget(self.trend_chart)
        self.add_widget(trend_section)

        # 双列：推广分布 + 成本结构
        bottom_layout = QHBoxLayout()
        bottom_layout.setSpacing(16)

        promo_section = SectionCard("推广渠道分布", "近 30 天")
        self.promo_chart = ChartView(height=280)
        promo_section.add_widget(self.promo_chart)
        bottom_layout.addWidget(promo_section)

        cost_section = SectionCard("成本结构", "近 30 天")
        self.cost_chart = ChartView(height=280)
        cost_section.add_widget(self.cost_chart)
        bottom_layout.addWidget(cost_section)

        self.add_layout(bottom_layout)

        # 利润目标进度
        target_section = SectionCard("利润目标进度", "年度/季度/月度完成情况")
        self.target_label = QLabel("")
        self.target_label.setStyleSheet("font-size: 14px; color: #1D1D1F; line-height: 1.6;")
        self.target_label.setWordWrap(True)
        target_section.add_widget(self.target_label)
        self.add_widget(target_section)

        self.add_stretch()

        # 首次加载
        self.refresh()

    def _init_toolbar(self):
        toolbar = QHBoxLayout()
        toolbar.setSpacing(8)

        toolbar.addWidget(QLabel("选择店铺:"))
        self.store_combo = QComboBox()
        self.store_combo.setMinimumWidth(200)
        self.store_combo.currentIndexChanged.connect(self._on_store_changed)
        toolbar.addWidget(self.store_combo)

        toolbar.addStretch()

        refresh_btn = QPushButton("刷新数据")
        refresh_btn.setObjectName("PrimaryButton")
        refresh_btn.clicked.connect(self.refresh)
        toolbar.addWidget(refresh_btn)

        # 添加到标题下方
        self._root_layout.addLayout(toolbar)

    def _load_stores(self):
        """加载店铺列表"""
        self.store_combo.blockSignals(True)
        self.store_combo.clear()
        self.store_combo.addItem("全店铺汇总", 0)
        try:
            with get_session() as session:
                svc = AnalyticsService(session)
                stores = svc.get_stores(active_only=True)
                for s in stores:
                    self.store_combo.addItem(f"{s.name}", s.id)
        except Exception as e:
            print(f"[WARN] 加载店铺失败: {e}")
        self.store_combo.blockSignals(False)

        # 设置当前选择
        idx = self.store_combo.findData(self.current_store_id)
        if idx >= 0:
            self.store_combo.setCurrentIndex(idx)

    def _on_store_changed(self, idx: int):
        self.current_store_id = self.store_combo.itemData(idx) or 0
        self.refresh()

    def refresh(self):
        """刷新所有数据"""
        # 加载店铺
        self._load_stores()

        try:
            with get_session() as session:
                svc = AnalyticsService(session)
                store_id = self.current_store_id

                # ============== 今日 KPI ==============
                today = svc.get_today_summary(store_id)
                mom = svc.get_mom_change(store_id)

                # 清空旧的 KPI 卡片
                while self.today_row.layout().count():
                    item = self.today_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                cards = [
                    KPICard("今日销售额", f"¥{today.sales_amount:,.0f}",
                            f"{today.order_count} 单", mom.get("sales_change"), "环比"),
                    KPICard("今日净利润", f"¥{today.net_profit:,.0f}",
                            f"利润率 {today.profit_rate*100:.1f}%", mom.get("profit_change"), "环比",
                            accent="#34C759"),
                    KPICard("今日 ROI", f"{today.roi:.2f}",
                            f"推广费率 {today.promotion_rate*100:.1f}%", None, "", accent="#0071E3"),
                    KPICard("今日客单价", f"¥{today.avg_order_value:.0f}",
                            f"单均利润 ¥{today.profit_per_order:.0f}", None, "", accent="#AF52DE"),
                    KPICard("今日退款率", f"{today.refund_rate*100:.1f}%",
                            f"退款 ¥{today.refund_amount:,.0f}", None, "",
                            accent="#FF3B30" if today.refund_rate > 0.08 else "#FF9500"),
                ]
                for c in cards:
                    self.today_row.layout().addWidget(c)

                # ============== 周/月/年 ==============
                week = svc.get_week_summary(store_id)
                month = svc.get_month_summary(store_id)
                year = svc.get_year_summary(store_id)

                while self.period_row.layout().count():
                    item = self.period_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                period_cards = [
                    KPICard("本周销售额", f"¥{week.sales_amount:,.0f}",
                            f"本周利润 ¥{week.net_profit:,.0f}", None, "", accent="#1D1D1F"),
                    KPICard("本月销售额", f"¥{month.sales_amount:,.0f}",
                            f"本月利润 ¥{month.net_profit:,.0f}", None, "", accent="#1D1D1F"),
                    KPICard("本月完成率", f"{month.profit_rate*100:.1f}%",
                            f"推广费率 {month.promotion_rate*100:.1f}%", None, "", accent="#1D1D1F"),
                    KPICard("年度 GMV", f"¥{year.sales_amount:,.0f}",
                            f"年度利润 ¥{year.net_profit:,.0f}", None, "", accent="#1D1D1F"),
                    KPICard("年度增长率", f"+{(year.net_profit/max(month.net_profit*12,1)*100-100):.0f}%",
                            f"按月推算年化", None, "", accent="#34C759"),
                ]
                for c in period_cards:
                    self.period_row.layout().addWidget(c)

                # ============== 趋势图 ==============
                trend = svc.get_trend(store_id, 30)
                if trend:
                    x_data = [p.date[5:] for p in trend]  # MM-DD
                    self.trend_chart.show_mix_chart(
                        "近 30 天经营趋势",
                        x_data=x_data,
                        bars=[{"name": "销售额", "data": [p.sales for p in trend], "color": "#0071E3"}],
                        lines=[{"name": "利润率", "data": [round(p.profit_rate*100, 1) for p in trend], "color": "#FF9500"}],
                    )

                # ============== 推广分布 ==============
                promo = svc.get_promotion_breakdown(store_id, 30)
                if promo:
                    self.promo_chart.show_pie_chart(
                        "推广渠道分布",
                        [{"name": k, "value": v} for k, v in promo.items()]
                    )

                # ============== 成本结构 ==============
                cost = svc.get_cost_breakdown(store_id, 30)
                if cost:
                    self.cost_chart.show_pie_chart(
                        "成本结构",
                        [{"name": k, "value": v} for k, v in cost.items()]
                    )

                # ============== 利润目标 ==============
                progress = svc.get_profit_target_progress(store_id)
                if progress:
                    lines = []
                    for k, v in progress.items():
                        target = v.get("target", 0)
                        actual = v.get("actual", 0)
                        rate = v.get("rate", 0) * 100
                        remaining = v.get("remaining", 0)
                        label_zh = {"yearly": "年度", "quarterly": "季度", "monthly": "月度"}.get(k, k)
                        color = "#34C759" if rate >= 80 else ("#FF9500" if rate >= 50 else "#FF3B30")
                        lines.append(f'<span style="color:{color};font-weight:600;">●</span> '
                                     f'<b>{label_zh}目标</b>: ¥{target:,.0f} | '
                                     f'已完成 ¥{actual:,.0f} ({rate:.1f}%) | '
                                     f'剩余 ¥{remaining:,.0f}')
                    self.target_label.setText("<br>".join(lines))
                else:
                    self.target_label.setText("暂未设置利润目标，请前往「利润目标管理」页面设置")

        except Exception as e:
            print(f"[ERROR] 驾驶舱刷新失败: {e}")
            import traceback
            traceback.print_exc()
