"""
报表中心页 - 日/周/月/年报 + Excel/PDF/Word/PPT 导出
"""
from datetime import date
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QFrame, QMessageBox, QFileDialog
)
from PySide6.QtCore import Qt

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.ui.components.kpi_card import KPICard, KPICardRow
from app.database.connection import get_session
from app.database.models import Store
from app.core.analytics import AnalyticsService
from app.core.exporter import ExportService


class ReportsPage(BasePage):
    title = "报表中心"
    subtitle = "日 / 周 / 月 / 年 报 + Excel / PDF / Word / PPT 导出"

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
        toolbar.addWidget(QLabel("报表周期:"))
        self.period_combo = QComboBox()
        for code, label in [("today", "今日"), ("week", "本周"), ("month", "本月"), ("year", "本年")]:
            self.period_combo.addItem(label, code)
        self.period_combo.currentIndexChanged.connect(lambda _: self.refresh())
        toolbar.addWidget(self.period_combo)

        toolbar.addStretch()
        self.add_layout(toolbar)

        # KPI 概览
        self.kpi_row = KPICardRow()
        self.add_widget(self.kpi_row)

        # 导出区
        export_section = SectionCard("一键导出报表", "支持 Excel / PDF / Word / PPT 多种格式")

        # Excel
        excel_layout = QHBoxLayout()
        excel_label = QLabel("📊 Excel 报表")
        excel_label.setStyleSheet("font-size: 16px; font-weight: 600; color: #1D1D1F; min-width: 120px;")
        excel_layout.addWidget(excel_label)

        excel_desc = QLabel("每日明细 + 汇总数据，便于二次加工")
        excel_desc.setStyleSheet("color: #6E6E73; font-size: 13px;")
        excel_layout.addWidget(excel_desc)
        excel_layout.addStretch()

        excel_daily_btn = QPushButton("导出每日明细")
        excel_daily_btn.clicked.connect(lambda: self._export("excel_daily"))
        excel_layout.addWidget(excel_daily_btn)

        excel_summary_btn = QPushButton("导出汇总报表")
        excel_summary_btn.clicked.connect(lambda: self._export("excel_summary"))
        excel_layout.addWidget(excel_summary_btn)

        export_section.add_layout(excel_layout)

        # PDF
        pdf_layout = QHBoxLayout()
        pdf_label = QLabel("📄 PDF 报表")
        pdf_label.setStyleSheet("font-size: 16px; font-weight: 600; color: #1D1D1F; min-width: 120px;")
        pdf_layout.addWidget(pdf_label)

        pdf_desc = QLabel("排版精美，适合打印和分享")
        pdf_desc.setStyleSheet("color: #6E6E73; font-size: 13px;")
        pdf_layout.addWidget(pdf_desc)
        pdf_layout.addStretch()

        pdf_btn = QPushButton("导出 PDF")
        pdf_btn.clicked.connect(lambda: self._export("pdf"))
        pdf_layout.addWidget(pdf_btn)

        export_section.add_layout(pdf_layout)

        # Word
        word_layout = QHBoxLayout()
        word_label = QLabel("📝 Word 报表")
        word_label.setStyleSheet("font-size: 16px; font-weight: 600; color: #1D1D1F; min-width: 120px;")
        word_layout.addWidget(word_label)

        word_desc = QLabel("可编辑格式，便于添加批注")
        word_desc.setStyleSheet("color: #6E6E73; font-size: 13px;")
        word_layout.addWidget(word_desc)
        word_layout.addStretch()

        word_btn = QPushButton("导出 Word")
        word_btn.clicked.connect(lambda: self._export("word"))
        word_layout.addWidget(word_btn)

        export_section.add_layout(word_layout)

        # PPT
        ppt_layout = QHBoxLayout()
        ppt_label = QLabel("🎯 PPT 老板汇报神器")
        ppt_label.setStyleSheet("font-size: 16px; font-weight: 600; color: #1D1D1F; min-width: 120px;")
        ppt_layout.addWidget(ppt_label)

        ppt_desc = QLabel("自动生成 5 页 PPT：销售概览 + 利润 + 趋势 + 爆款 + 计划")
        ppt_desc.setStyleSheet("color: #6E6E73; font-size: 13px;")
        ppt_layout.addWidget(ppt_desc)
        ppt_layout.addStretch()

        ppt_btn = QPushButton("导出 PPT")
        ppt_btn.setObjectName("PrimaryButton")
        ppt_btn.clicked.connect(lambda: self._export("ppt"))
        ppt_layout.addWidget(ppt_btn)

        export_section.add_layout(ppt_layout)

        self.add_widget(export_section)

        # 明细预览
        preview_section = SectionCard("每日明细预览", "最近 30 天数据")
        self.preview_table = QTableWidget()
        self.preview_table.setColumnCount(10)
        self.preview_table.setHorizontalHeaderLabels([
            "日期", "销售额", "订单", "客单价", "退款率", "推广费", "成本", "净利润", "利润率", "ROI"
        ])
        self.preview_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.preview_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        preview_section.add_widget(self.preview_table)
        self.add_widget(preview_section)

        self.add_stretch()

        self._load_stores()

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
        period = self.period_combo.currentData() or "month"

        try:
            with get_session() as session:
                svc = AnalyticsService(session)

                if period == "today":
                    summary = svc.get_today_summary(self.current_store_id)
                elif period == "week":
                    summary = svc.get_week_summary(self.current_store_id)
                elif period == "year":
                    summary = svc.get_year_summary(self.current_store_id)
                else:
                    summary = svc.get_month_summary(self.current_store_id)

                # KPI
                while self.kpi_row.layout().count():
                    item = self.kpi_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                for c in [
                    KPICard("销售额", f"¥{summary.sales_amount:,.0f}", f"{summary.order_count} 单", None, ""),
                    KPICard("净利润", f"¥{summary.net_profit:,.0f}", f"利润率 {summary.profit_rate*100:.1f}%", None, "", accent="#34C759"),
                    KPICard("ROI", f"{summary.roi:.2f}", f"推广费率 {summary.promotion_rate*100:.1f}%", None, "", accent="#0071E3"),
                    KPICard("客单价", f"¥{summary.avg_order_value:.0f}", f"单均利润 ¥{summary.profit_per_order:.0f}", None, "", accent="#AF52DE"),
                    KPICard("退款率", f"{summary.refund_rate*100:.1f}%", f"退款 ¥{summary.refund_amount:,.0f}", None, "", accent="#FF9500"),
                ]:
                    self.kpi_row.layout().addWidget(c)

                # 明细表
                records = svc.get_daily_records(self.current_store_id, 30)
                self.preview_table.setRowCount(len(records))
                for row, r in enumerate(records):
                    self.preview_table.setItem(row, 0, QTableWidgetItem(r.record_date.isoformat()))
                    self.preview_table.setItem(row, 1, QTableWidgetItem(f"¥{r.sales_amount:,.0f}"))
                    self.preview_table.setItem(row, 2, QTableWidgetItem(str(r.order_count)))
                    self.preview_table.setItem(row, 3, QTableWidgetItem(f"¥{r.avg_order_value:.0f}"))
                    self.preview_table.setItem(row, 4, QTableWidgetItem(f"{r.refund_rate*100:.1f}%"))
                    self.preview_table.setItem(row, 5, QTableWidgetItem(f"¥{r.promotion_total:,.0f}"))
                    self.preview_table.setItem(row, 6, QTableWidgetItem(f"¥{r.cost_total:,.0f}"))
                    self.preview_table.setItem(row, 7, QTableWidgetItem(f"¥{r.net_profit:,.0f}"))
                    self.preview_table.setItem(row, 8, QTableWidgetItem(f"{r.profit_rate*100:.1f}%"))
                    self.preview_table.setItem(row, 9, QTableWidgetItem(f"{r.roi:.2f}"))

        except Exception as e:
            print(f"[ERROR] 报表页刷新失败: {e}")

    def _export(self, format_key: str):
        self.current_store_id = self.store_combo.currentData() or 0
        period = self.period_combo.currentData() or "month"

        try:
            with get_session() as session:
                svc = ExportService(session)

                if format_key == "excel_daily":
                    path = svc.export_daily_excel(self.current_store_id, 30)
                elif format_key == "excel_summary":
                    path = svc.export_summary_excel(self.current_store_id)
                elif format_key == "pdf":
                    path = svc.export_pdf(self.current_store_id, period)
                elif format_key == "word":
                    path = svc.export_word(self.current_store_id, period)
                elif format_key == "ppt":
                    path = svc.export_ppt(self.current_store_id)
                else:
                    return

            QMessageBox.information(self, "导出成功", f"报表已导出:\n\n{path}\n\n可在「数据备份」目录中查看")
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出失败: {e}")
