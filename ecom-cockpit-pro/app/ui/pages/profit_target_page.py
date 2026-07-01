"""
利润目标管理页
"""
from datetime import date
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox, QSpinBox,
    QDoubleSpinBox, QFormLayout, QDialog, QTableWidget, QTableWidgetItem,
    QHeaderView, QAbstractItemView, QMessageBox, QFrame, QProgressBar, QSplitter
)
from PySide6.QtCore import Qt, QThread, Signal

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.ui.components.kpi_card import KPICard, KPICardRow
from app.database.connection import get_session
from app.database.models import Store, ProfitTarget
from app.core.analytics import AnalyticsService
from app.core.ai_service import AIService


class TargetEditDialog(QDialog):
    """目标编辑对话框"""

    def __init__(self, target: ProfitTarget = None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("编辑目标" if target else "新增目标")
        self.setMinimumWidth(400)

        layout = QFormLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(12)

        self.store_combo = QComboBox()
        self.store_combo.addItem("全店铺汇总", 0)
        with get_session() as session:
            stores = list(session.query(Store).filter(Store.is_active == True).order_by(Store.id).all())
            for s in stores:
                self.store_combo.addItem(s.name, s.id)
        if target:
            idx = self.store_combo.findData(target.store_id)
            if idx >= 0:
                self.store_combo.setCurrentIndex(idx)
        layout.addRow("店铺", self.store_combo)

        self.type_combo = QComboBox()
        self.type_combo.addItem("年度目标", "yearly")
        self.type_combo.addItem("季度目标", "quarterly")
        self.type_combo.addItem("月度目标", "monthly")
        if target:
            idx = self.type_combo.findData(target.target_type)
            if idx >= 0:
                self.type_combo.setCurrentIndex(idx)
        self.type_combo.currentIndexChanged.connect(self._on_type_changed)
        layout.addRow("目标类型", self.type_combo)

        self.year_input = QSpinBox()
        self.year_input.setRange(2020, 2099)
        self.year_input.setValue(target.target_year if target else date.today().year)
        layout.addRow("年份", self.year_input)

        self.quarter_input = QSpinBox()
        self.quarter_input.setRange(1, 4)
        self.quarter_input.setValue(target.target_quarter if target and target.target_quarter else (date.today().month - 1) // 3 + 1)
        layout.addRow("季度", self.quarter_input)

        self.month_input = QSpinBox()
        self.month_input.setRange(1, 12)
        self.month_input.setValue(target.target_month if target and target.target_month else date.today().month)
        layout.addRow("月份", self.month_input)

        self.amount_input = QDoubleSpinBox()
        self.amount_input.setRange(0, 999999999)
        self.amount_input.setDecimals(2)
        self.amount_input.setPrefix("¥ ")
        self.amount_input.setValue(target.target_amount if target else 0)
        layout.addRow("目标利润", self.amount_input)

        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        save_btn = QPushButton("保存")
        save_btn.setObjectName("PrimaryButton")
        save_btn.clicked.connect(self._on_save)
        btn_layout.addWidget(save_btn)
        layout.addRow(btn_layout)

        self._on_type_changed()

    def _on_type_changed(self):
        t = self.type_combo.currentData()
        self.quarter_input.setVisible(t == "quarterly")
        self.month_input.setVisible(t == "monthly")

    def _on_save(self):
        if self.amount_input.value() <= 0:
            QMessageBox.warning(self, "提示", "请输入目标金额")
            return
        self.accept()

    def get_data(self) -> dict:
        t = self.type_combo.currentData()
        return {
            "store_id": self.store_combo.currentData(),
            "target_type": t,
            "target_year": self.year_input.value(),
            "target_quarter": self.quarter_input.value() if t == "quarterly" else None,
            "target_month": self.month_input.value() if t == "monthly" else None,
            "target_amount": self.amount_input.value(),
        }


class AIProfitPredictTask(QThread):
    finished = Signal(str)
    error = Signal(str)

    def __init__(self, store_id: int):
        super().__init__()
        self.store_id = store_id

    def run(self):
        try:
            with get_session() as session:
                svc = AIService(session)
                result = svc.predict_profit_target(self.store_id)
                self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))


class ProfitTargetPage(BasePage):
    title = "利润目标管理"
    subtitle = "年度 / 季度 / 月度 目标管理 + AI 预测"

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

        add_btn = QPushButton("+ 新增目标")
        add_btn.setObjectName("PrimaryButton")
        add_btn.clicked.connect(self._on_add_target)
        toolbar.addWidget(add_btn)
        self.add_layout(toolbar)

        # 进度卡片
        self.progress_row = KPICardRow()
        self.add_widget(self.progress_row)

        # 双列：目标列表 + AI 预测
        bottom_layout = QHBoxLayout()
        bottom_layout.setSpacing(16)

        # 目标列表
        list_section = SectionCard("目标列表", "管理所有利润目标")
        self.target_table = QTableWidget()
        self.target_table.setColumnCount(6)
        self.target_table.setHorizontalHeaderLabels(["类型", "周期", "目标金额", "操作"])
        self.target_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        list_section.add_widget(self.target_table)
        bottom_layout.addWidget(list_section)

        # AI 预测
        ai_section = SectionCard("AI 目标预测", "GLM-4 基于当前进度预测完成情况")
        ai_btn_layout = QHBoxLayout()
        ai_btn_layout.addStretch()
        predict_btn = QPushButton("AI 预测")
        predict_btn.setObjectName("PrimaryButton")
        predict_btn.clicked.connect(self._on_predict)
        ai_btn_layout.addWidget(predict_btn)
        ai_section.add_layout(ai_btn_layout)

        self.predict_result = QLabel("点击「AI 预测」按钮，GLM-4 将基于当前进度预测目标完成情况")
        self.predict_result.setWordWrap(True)
        self.predict_result.setStyleSheet("""
            QLabel {
                background: #FFFFFF;
                border: 1px solid #E5E5EA;
                border-radius: 8px;
                padding: 16px;
                font-size: 13px;
                color: #1D1D1F;
            }
        """)
        self.predict_result.setMinimumHeight(300)
        self.predict_result.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        ai_section.add_widget(self.predict_result)

        bottom_layout.addWidget(ai_section)

        self.add_layout(bottom_layout)
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

        try:
            with get_session() as session:
                svc = AnalyticsService(session)
                progress = svc.get_profit_target_progress(self.current_store_id)

                # 清空进度卡片
                while self.progress_row.layout().count():
                    item = self.progress_row.layout().takeAt(0)
                    if item.widget():
                        item.widget().deleteLater()

                if not progress:
                    self.progress_row.layout().addWidget(KPICard(
                        "暂无目标", "—", "请点击右上角新增目标", None, ""
                    ))
                else:
                    for k, v in progress.items():
                        target = v.get("target", 0)
                        actual = v.get("actual", 0)
                        rate = v.get("rate", 0)
                        remaining = v.get("remaining", 0)
                        label_zh = {"yearly": "年度", "quarterly": "季度", "monthly": "月度"}.get(k, k)

                        if rate >= 0.8:
                            color = "#34C759"
                        elif rate >= 0.5:
                            color = "#FF9500"
                        else:
                            color = "#FF3B30"

                        card = KPICard(
                            f"{label_zh}目标",
                            f"{rate*100:.1f}%",
                            f"目标 ¥{target:,.0f} · 已完成 ¥{actual:,.0f}",
                            None, "",
                            accent=color
                        )
                        self.progress_row.layout().addWidget(card)

                # 目标列表
                targets = list(session.query(ProfitTarget).filter(
                    (ProfitTarget.store_id == self.current_store_id) | (ProfitTarget.store_id == 0)
                    if self.current_store_id else True
                ).order_by(ProfitTarget.target_year.desc(), ProfitTarget.target_type).all())

                self.target_table.setRowCount(len(targets))
                for row, t in enumerate(targets):
                    type_label = {"yearly": "年度", "quarterly": "季度", "monthly": "月度"}.get(t.target_type, t.target_type)
                    if t.target_type == "yearly":
                        period = f"{t.target_year} 年"
                    elif t.target_type == "quarterly":
                        period = f"{t.target_year} 年 Q{t.target_quarter}"
                    else:
                        period = f"{t.target_year} 年 {t.target_month} 月"

                    self.target_table.setItem(row, 0, QTableWidgetItem(type_label))
                    self.target_table.setItem(row, 1, QTableWidgetItem(period))
                    self.target_table.setItem(row, 2, QTableWidgetItem(f"¥{t.target_amount:,.0f}"))

                    # 操作
                    op_widget = QFrame()
                    op_layout = QHBoxLayout(op_widget)
                    op_layout.setContentsMargins(4, 4, 4, 4)

                    edit_btn = QPushButton("编辑")
                    edit_btn.setStyleSheet("padding: 2px 8px; font-size: 12px;")
                    edit_btn.clicked.connect(lambda checked=False, tid=t.id: self._on_edit_target(tid))
                    op_layout.addWidget(edit_btn)

                    del_btn = QPushButton("删除")
                    del_btn.setStyleSheet("padding: 2px 8px; font-size: 12px; color: #FF3B30;")
                    del_btn.clicked.connect(lambda checked=False, tid=t.id: self._on_delete_target(tid))
                    op_layout.addWidget(del_btn)

                    self.target_table.setCellWidget(row, 3, op_widget)

        except Exception as e:
            print(f"[ERROR] 利润目标页刷新失败: {e}")

    def _on_add_target(self):
        dlg = TargetEditDialog(parent=self)
        if dlg.exec() == QDialog.Accepted:
            data = dlg.get_data()
            with get_session() as session:
                target = ProfitTarget(**data)
                session.add(target)
                session.commit()
            QMessageBox.information(self, "成功", "目标已创建")
            self.refresh()

    def _on_edit_target(self, target_id: int):
        with get_session() as session:
            target = session.get(ProfitTarget, target_id)
            if not target:
                return
            dlg = TargetEditDialog(target=target, parent=self)
            if dlg.exec() == QDialog.Accepted:
                data = dlg.get_data()
                for k, v in data.items():
                    setattr(target, k, v)
                session.commit()
        self.refresh()

    def _on_delete_target(self, target_id: int):
        reply = QMessageBox.question(self, "确认", "确定删除该目标？")
        if reply != QMessageBox.Yes:
            return
        with get_session() as session:
            target = session.get(ProfitTarget, target_id)
            if target:
                session.delete(target)
                session.commit()
        self.refresh()

    def _on_predict(self):
        if self._ai_task and self._ai_task.isRunning():
            QMessageBox.warning(self, "提示", "已有任务在执行")
            return

        self.current_store_id = self.store_combo.currentData() or 0
        self.predict_result.setText("🤖 GLM-4 正在分析...")

        self._ai_task = AIProfitPredictTask(self.current_store_id)
        self._ai_task.finished.connect(self._on_predict_ready)
        self._ai_task.error.connect(self._on_predict_error)
        self._ai_task.start()

    def _on_predict_ready(self, result: str):
        import re
        # 简单 Markdown 转 HTML
        html = result
        html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', html)
        html = html.replace("\n", "<br>")
        self.predict_result.setText(html)

    def _on_predict_error(self, err: str):
        self.predict_result.setText(f"❌ 预测失败: {err}")
