"""
SKU 利润分析页
"""
from datetime import date
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox, QSpinBox,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QTabWidget, QWidget, QFrame
)
from PySide6.QtCore import Qt

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.ui.components.kpi_card import KPICard, KPICardRow
from app.ui.components.chart_view import ChartView
from app.database.connection import get_session
from app.database.models import Store, SKU
from app.core.analytics import AnalyticsService


class SKUPage(BasePage):
    title = "SKU 利润分析"
    subtitle = "单品销售 / 利润 / ROI / 退款率分析"

    def __init__(self):
        super().__init__()
        self.current_store_id = 0

        # 顶部
        toolbar = QHBoxLayout()
        toolbar.addWidget(QLabel("选择店铺:"))
        self.store_combo = QComboBox()
        self.store_combo.setMinimumWidth(220)
        self.store_combo.currentIndexChanged.connect(lambda _: self.refresh())
        toolbar.addWidget(self.store_combo)

        toolbar.addSpacing(16)
        toolbar.addWidget(QLabel("分析周期:"))
        self.days_combo = QComboBox()
        for d, l in [(7, "近 7 天"), (30, "近 30 天"), (90, "近 90 天")]:
            self.days_combo.addItem(l, d)
        self.days_combo.currentIndexChanged.connect(lambda _: self.refresh())
        toolbar.addWidget(self.days_combo)

        toolbar.addStretch()
        self.add_layout(toolbar)

        # 4 个排行榜 Tab
        self.tabs = QTabWidget()
        self.tab_top = QWidget()      # 爆款排行
        self.tab_profit = QWidget()   # 利润排行
        self.tab_slow = QWidget()     # 滞销排行
        self.tab_refund = QWidget()   # 高退款排行

        self.tabs.addTab(self.tab_top, "爆款排行")
        self.tabs.addTab(self.tab_profit, "利润排行")
        self.tabs.addTab(self.tab_slow, "滞销排行")
        self.tabs.addTab(self.tab_refund, "高退款排行")

        self._init_rank_tab(self.tab_top, "sales", "销售额", "#0071E3")
        self._init_rank_tab(self.tab_profit, "gross_profit", "毛利润", "#34C759")
        self._init_rank_tab(self.tab_slow, "quantity", "销量(升序)", "#FF9500", ascending=True)
        self._init_rank_tab(self.tab_refund, "refund_rate", "退款率", "#FF3B30")

        self.add_widget(self.tabs)
        self.add_stretch()

        self._load_stores()

    def _init_rank_tab(self, tab: QWidget, sort_key: str, label: str, color: str, ascending: bool = False):
        layout = QVBoxLayout(tab)
        layout.setSpacing(12)

        # KPI 行
        kpi_row = KPICardRow()
        layout.addWidget(kpi_row)

        # 图表
        chart_section = SectionCard(f"TOP 10 {label}排行", "")
        chart = ChartView(height=280)
        chart_section.add_widget(chart)
        layout.addWidget(chart_section)

        # 表格
        table_section = SectionCard("明细数据", "")
        table = QTableWidget()
        table.setColumnCount(10)
        table.setHorizontalHeaderLabels([
            "排名", "SKU 编码", "商品名称", "类目", "销售额", "销量", "毛利润", "ROI", "退款率", "库存"
        ])
        table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        table_section.add_widget(table)
        layout.addWidget(table_section)

        # 保存引用
        if not hasattr(self, "_rank_kpi_rows"):
            self._rank_kpi_rows = {}
            self._rank_charts = {}
            self._rank_tables = {}
        self._rank_kpi_rows[sort_key] = kpi_row
        self._rank_charts[sort_key] = chart
        self._rank_tables[sort_key] = table

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
        days = self.days_combo.currentData() or 30

        try:
            with get_session() as session:
                svc = AnalyticsService(session)
                sku_stats = svc.get_sku_stats(self.current_store_id, days)

                # 排序
                rankings = {
                    "sales": sorted(sku_stats, key=lambda s: s.sales_amount, reverse=True),
                    "gross_profit": sorted(sku_stats, key=lambda s: s.gross_profit, reverse=True),
                    "quantity": sorted(sku_stats, key=lambda s: s.quantity),
                    "refund_rate": sorted(sku_stats, key=lambda s: s.refund_rate, reverse=True),
                }

                for sort_key, ranked in rankings.items():
                    kpi_row = self._rank_kpi_rows[sort_key]
                    chart = self._rank_charts[sort_key]
                    table = self._rank_tables[sort_key]

                    # KPI 概览
                    while kpi_row.layout().count():
                        item = kpi_row.layout().takeAt(0)
                        if item.widget():
                            item.widget().deleteLater()

                    if ranked:
                        total_sales = sum(s.sales_amount for s in ranked)
                        total_profit = sum(s.gross_profit for s in ranked)
                        avg_roi = sum(s.roi for s in ranked) / len(ranked)
                        avg_refund = sum(s.refund_rate for s in ranked) / len(ranked)

                        for c in [
                            KPICard("SKU 总数", f"{len(ranked)}", f"分析周期: {days} 天", None, ""),
                            KPICard("总销售额", f"¥{total_sales:,.0f}", f"总利润 ¥{total_profit:,.0f}", None, "", accent="#0071E3"),
                            KPICard("平均 ROI", f"{avg_roi:.2f}", f"日均销售 ¥{total_sales/days:,.0f}", None, "", accent="#34C759"),
                            KPICard("平均退款率", f"{avg_refund*100:.1f}%", f"健康度 {'良好' if avg_refund < 0.05 else '关注'}", None, "",
                                    accent="#34C759" if avg_refund < 0.05 else "#FF9500"),
                        ]:
                            kpi_row.layout().addWidget(c)

                    # 图表
                    if ranked:
                        top10 = ranked[:10]
                        x_data = [s.sku_name[:8] for s in top10]
                        if sort_key == "sales":
                            data = [s.sales_amount for s in top10]
                            color = "#0071E3"
                            title = "TOP 10 销售额"
                        elif sort_key == "gross_profit":
                            data = [s.gross_profit for s in top10]
                            color = "#34C759"
                            title = "TOP 10 毛利润"
                        elif sort_key == "quantity":
                            data = [s.quantity for s in top10]
                            color = "#FF9500"
                            title = "滞销 TOP 10（按销量升序）"
                        else:
                            data = [s.refund_rate * 100 for s in top10]
                            color = "#FF3B30"
                            title = "高退款率 TOP 10"

                        chart.show_bar_chart(
                            title,
                            x_data=x_data,
                            series=[{"name": title, "data": data, "color": color}]
                        )

                    # 表格
                    table.setRowCount(len(ranked))
                    for row, s in enumerate(ranked):
                        table.setItem(row, 0, QTableWidgetItem(str(row + 1)))
                        table.setItem(row, 1, QTableWidgetItem(s.sku_code))
                        table.setItem(row, 2, QTableWidgetItem(s.sku_name))
                        table.setItem(row, 3, QTableWidgetItem(s.category or "-"))
                        table.setItem(row, 4, QTableWidgetItem(f"¥{s.sales_amount:,.0f}"))
                        table.setItem(row, 5, QTableWidgetItem(f"{s.quantity}"))
                        table.setItem(row, 6, QTableWidgetItem(f"¥{s.gross_profit:,.0f}"))
                        table.setItem(row, 7, QTableWidgetItem(f"{s.roi:.2f}"))
                        table.setItem(row, 8, QTableWidgetItem(f"{s.refund_rate*100:.1f}%"))
                        table.setItem(row, 9, QTableWidgetItem(f"{s.stock}"))

        except Exception as e:
            print(f"[ERROR] SKU 页刷新失败: {e}")
            import traceback
            traceback.print_exc()
