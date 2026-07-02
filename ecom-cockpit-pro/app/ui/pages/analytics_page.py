"""
经营分析中心页 - 日/周/月/年四档分析
"""
from datetime import date, timedelta
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox, QTabWidget,
    QWidget, QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QFrame, QSizePolicy, QDateEdit
)
from PySide6.QtCore import Qt, QDate

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.ui.components.kpi_card import KPICard, KPICardRow
from app.ui.components.chart_view import ChartView
from app.ui.components.empty_state import EmptyState
from app.database.connection import get_session
from app.core.analytics import AnalyticsService


class AnalyticsPage(BasePage):
    title = "经营分析中心"
    subtitle = "日 / 周 / 月 / 年 四档分析"

    def __init__(self):
        super().__init__()
        self.current_store_id = 0

        # 顶部工具栏
        toolbar = QHBoxLayout()
        toolbar.addWidget(QLabel("选择店铺:"))
        self.store_combo = QComboBox()
        self.store_combo.setMinimumWidth(200)
        self.store_combo.currentIndexChanged.connect(lambda _: self.refresh())
        toolbar.addWidget(self.store_combo)
        toolbar.addStretch()
        self.add_layout(toolbar)

        # Tab 切换
        self.tabs = QTabWidget()
        self.tabs.currentChanged.connect(lambda idx: self.refresh() if idx >= 0 else None)

        self.daily_tab = QWidget()
        self.weekly_tab = QWidget()
        self.monthly_tab = QWidget()
        self.yearly_tab = QWidget()

        # 先初始化所有 Tab 内容（包含 self.daily_date 等属性），再添加 Tab
        # 避免 addTab 触发 currentChanged 时属性还未创建
        self._init_daily_tab()
        self._init_weekly_tab()
        self._init_monthly_tab()
        self._init_yearly_tab()

        self.tabs.blockSignals(True)
        self.tabs.addTab(self.daily_tab, "日分析")
        self.tabs.addTab(self.weekly_tab, "周分析")
        self.tabs.addTab(self.monthly_tab, "月分析")
        self.tabs.addTab(self.yearly_tab, "年分析")
        self.tabs.blockSignals(False)

        self.add_widget(self.tabs)
        self.add_stretch()

        self._load_stores()

    def _init_daily_tab(self):
        layout = QVBoxLayout(self.daily_tab)
        layout.setSpacing(16)

        # 日期选择
        date_row = QHBoxLayout()
        date_row.addWidget(QLabel("分析日期:"))
        self.daily_date = QDateEdit()
        self.daily_date.setDate(QDate.currentDate())
        self.daily_date.setCalendarPopup(True)
        self.daily_date.setDisplayFormat("yyyy-MM-dd")
        date_row.addWidget(self.daily_date)
        date_row.addStretch()

        btn = QPushButton("重新分析")
        btn.setObjectName("PrimaryButton")
        btn.clicked.connect(self.refresh)
        date_row.addWidget(btn)
        layout.addLayout(date_row)

        # KPI 行
        self.daily_kpi_row = KPICardRow()
        layout.addWidget(self.daily_kpi_row)

        # 表格
        table_section = SectionCard("最近 7 天明细", "")
        self.daily_table = QTableWidget()
        self.daily_table.setColumnCount(10)
        self.daily_table.setHorizontalHeaderLabels([
            "日期", "销售额", "订单", "客单价", "退款率", "推广费", "成本", "净利润", "利润率", "ROI"
        ])
        self.daily_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        table_section.add_widget(self.daily_table)
        layout.addWidget(table_section)

    def _init_weekly_tab(self):
        layout = QVBoxLayout(self.weekly_tab)
        layout.setSpacing(16)

        self.weekly_kpi_row = KPICardRow()
        layout.addWidget(self.weekly_kpi_row)

        trend_section = SectionCard("本周 vs 上周对比", "")
        self.weekly_chart = ChartView(height=320)
        trend_section.add_widget(self.weekly_chart)
        layout.addWidget(trend_section)

    def _init_monthly_tab(self):
        layout = QVBoxLayout(self.monthly_tab)
        layout.setSpacing(16)

        self.monthly_kpi_row = KPICardRow()
        layout.addWidget(self.monthly_kpi_row)

        trend_section = SectionCard("本月每日趋势", "")
        self.monthly_chart = ChartView(height=320)
        trend_section.add_widget(self.monthly_chart)
        layout.addWidget(trend_section)

    def _init_yearly_tab(self):
        layout = QVBoxLayout(self.yearly_tab)
        layout.setSpacing(16)

        self.yearly_kpi_row = KPICardRow()
        layout.addWidget(self.yearly_kpi_row)

        trend_section = SectionCard("本年月度趋势", "按月汇总")
        self.yearly_chart = ChartView(height=320)
        trend_section.add_widget(self.yearly_chart)
        layout.addWidget(trend_section)

    def _load_stores(self):
        self.store_combo.blockSignals(True)
        self.store_combo.clear()
        self.store_combo.addItem("全店铺汇总", 0)
        with get_session() as session:
            from app.database.models import Store
            stores = list(session.query(Store).filter(Store.is_active == True).order_by(Store.id).all())
            for s in stores:
                self.store_combo.addItem(s.name, s.id)
        self.store_combo.blockSignals(False)

    def refresh(self):
        self._load_stores()
        self.current_store_id = self.store_combo.currentData() or 0

        try:
            with get_session() as session:
                svc = AnalyticsService(session)
                sid = self.current_store_id

                # 日分析
                target_date = self.daily_date.date().toPython()
                day_summary = svc.get_custom_summary(sid, target_date, target_date)
                yesterday_summary = svc.get_custom_summary(sid, target_date - timedelta(days=1), target_date - timedelta(days=1))

                # 清空 KPI
                while self.daily_kpi_row.layout().count():
                    item = self.daily_kpi_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                sales_change = ((day_summary.sales_amount - yesterday_summary.sales_amount) / yesterday_summary.sales_amount) if yesterday_summary.sales_amount else 0
                profit_change = ((day_summary.net_profit - yesterday_summary.net_profit) / yesterday_summary.net_profit) if yesterday_summary.net_profit else 0

                for c in [
                    KPICard("日销售额", f"¥{day_summary.sales_amount:,.0f}",
                            f"{day_summary.order_count} 单", sales_change, "环比"),
                    KPICard("日净利润", f"¥{day_summary.net_profit:,.0f}",
                            f"利润率 {day_summary.profit_rate*100:.1f}%", profit_change, "环比", accent="#34C759"),
                    KPICard("日 ROI", f"{day_summary.roi:.2f}",
                            f"推广费率 {day_summary.promotion_rate*100:.1f}%", None, "", accent="#0071E3"),
                    KPICard("日退款率", f"{day_summary.refund_rate*100:.1f}%",
                            f"退款 ¥{day_summary.refund_amount:,.0f}", None, "",
                            accent="#FF3B30" if day_summary.refund_rate > 0.08 else "#FF9500"),
                    KPICard("日异常检测", "正常" if day_summary.profit_rate > 0.05 else "关注",
                            f"利润率 {'正常' if day_summary.profit_rate > 0.05 else '偏低'}", None, "",
                            accent="#34C759" if day_summary.profit_rate > 0.05 else "#FF3B30"),
                ]:
                    self.daily_kpi_row.layout().addWidget(c)

                # 日明细
                recent_records = svc.get_daily_records(sid, 7)
                self.daily_table.setRowCount(len(recent_records))
                for row, r in enumerate(recent_records):
                    self.daily_table.setItem(row, 0, QTableWidgetItem(r.record_date.isoformat()))
                    self.daily_table.setItem(row, 1, QTableWidgetItem(f"¥{r.sales_amount:,.0f}"))
                    self.daily_table.setItem(row, 2, QTableWidgetItem(str(r.order_count)))
                    self.daily_table.setItem(row, 3, QTableWidgetItem(f"¥{r.avg_order_value:.0f}"))
                    self.daily_table.setItem(row, 4, QTableWidgetItem(f"{r.refund_rate*100:.1f}%"))
                    self.daily_table.setItem(row, 5, QTableWidgetItem(f"¥{r.promotion_total:,.0f}"))
                    self.daily_table.setItem(row, 6, QTableWidgetItem(f"¥{r.cost_total:,.0f}"))
                    self.daily_table.setItem(row, 7, QTableWidgetItem(f"¥{r.net_profit:,.0f}"))
                    self.daily_table.setItem(row, 8, QTableWidgetItem(f"{r.profit_rate*100:.1f}%"))
                    self.daily_table.setItem(row, 9, QTableWidgetItem(f"{r.roi:.2f}"))

                # 周分析
                week = svc.get_week_summary(sid)
                last_week_start = date.today() - timedelta(days=date.today().weekday() + 7)
                last_week_end = last_week_start + timedelta(days=6)
                last_week = svc.get_custom_summary(sid, last_week_start, last_week_end)

                while self.weekly_kpi_row.layout().count():
                    item = self.weekly_kpi_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                w_sales_change = ((week.sales_amount - last_week.sales_amount) / last_week.sales_amount) if last_week.sales_amount else 0
                w_profit_change = ((week.net_profit - last_week.net_profit) / last_week.net_profit) if last_week.net_profit else 0

                for c in [
                    KPICard("本周销售额", f"¥{week.sales_amount:,.0f}",
                            f"{week.order_count} 单", w_sales_change, "环比上周"),
                    KPICard("本周净利润", f"¥{week.net_profit:,.0f}",
                            f"利润率 {week.profit_rate*100:.1f}%", w_profit_change, "环比上周", accent="#34C759"),
                    KPICard("本周 ROI", f"{week.roi:.2f}", f"推广 ¥{week.promotion_total:,.0f}", None, "", accent="#0071E3"),
                    KPICard("本周客单价", f"¥{week.avg_order_value:.0f}",
                            f"单均利润 ¥{week.profit_per_order:.0f}", None, "", accent="#AF52DE"),
                ]:
                    self.weekly_kpi_row.layout().addWidget(c)

                # 周对比图
                trend_14 = svc.get_trend(sid, 14)
                if trend_14:
                    x_data = [p.date[5:] for p in trend_14]
                    self.weekly_chart.show_bar_chart(
                        "本周 vs 上周每日销售对比",
                        x_data=x_data,
                        series=[{"name": "销售额", "data": [p.sales for p in trend_14], "color": "#0071E3"}]
                    )

                # 月分析
                month = svc.get_month_summary(sid)
                trend_30 = svc.get_trend(sid, 30)

                while self.monthly_kpi_row.layout().count():
                    item = self.monthly_kpi_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                for c in [
                    KPICard("本月销售额", f"¥{month.sales_amount:,.0f}", f"{month.order_count} 单", None, "", accent="#1D1D1F"),
                    KPICard("本月净利润", f"¥{month.net_profit:,.0f}", f"利润率 {month.profit_rate*100:.1f}%", None, "", accent="#34C759"),
                    KPICard("本月 ROI", f"{month.roi:.2f}", f"推广 ¥{month.promotion_total:,.0f}", None, "", accent="#0071E3"),
                    KPICard("本月退款率", f"{month.refund_rate*100:.1f}%", f"退款 ¥{month.refund_amount:,.0f}", None, "", accent="#FF9500"),
                ]:
                    self.monthly_kpi_row.layout().addWidget(c)

                if trend_30:
                    x_data = [p.date[5:] for p in trend_30]
                    self.monthly_chart.show_mix_chart(
                        "本月每日销售/利润趋势",
                        x_data=x_data,
                        bars=[{"name": "销售额", "data": [p.sales for p in trend_30], "color": "#0071E3"}],
                        lines=[{"name": "利润率", "data": [round(p.profit_rate*100, 1) for p in trend_30], "color": "#FF9500"}],
                    )

                # 年分析
                year = svc.get_year_summary(sid)
                trend_180 = svc.get_trend(sid, min(180, 365))

                while self.yearly_kpi_row.layout().count():
                    item = self.yearly_kpi_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                for c in [
                    KPICard("年度 GMV", f"¥{year.sales_amount:,.0f}", f"{year.order_count} 单", None, "", accent="#1D1D1F"),
                    KPICard("年度净利润", f"¥{year.net_profit:,.0f}", f"利润率 {year.profit_rate*100:.1f}%", None, "", accent="#34C759"),
                    KPICard("年度 ROI", f"¥{year.roi:.2f}", f"年度推广 ¥{year.promotion_total:,.0f}", None, "", accent="#0071E3"),
                    KPICard("年度客单价", f"¥{year.avg_order_value:.0f}", f"日均销售 ¥{year.sales_amount/year.days:,.0f}", None, "", accent="#AF52DE"),
                ]:
                    self.yearly_kpi_row.layout().addWidget(c)

                if trend_180:
                    # 按月聚合
                    monthly_agg = {}
                    for p in trend_180:
                        month_key = p.date[:7]  # YYYY-MM
                        if month_key not in monthly_agg:
                            monthly_agg[month_key] = {"sales": 0, "profit": 0}
                        monthly_agg[month_key]["sales"] += p.sales
                        monthly_agg[month_key]["profit"] += p.profit

                    x_data = list(monthly_agg.keys())
                    self.yearly_chart.show_bar_chart(
                        "本年月度销售/利润趋势",
                        x_data=x_data,
                        series=[
                            {"name": "销售额", "data": [v["sales"] for v in monthly_agg.values()], "color": "#0071E3"},
                            {"name": "净利润", "data": [v["profit"] for v in monthly_agg.values()], "color": "#34C759"},
                        ],
                    )

        except Exception as e:
            print(f"[ERROR] 分析页刷新失败: {e}")
            import traceback
            traceback.print_exc()
