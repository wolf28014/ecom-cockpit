"""
多店铺管理页
"""
from typing import List
from datetime import date

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QTableWidget, QTableWidgetItem,
    QDialog, QFormLayout, QLineEdit, QComboBox, QTextEdit, QCheckBox, QMessageBox,
    QHeaderView, QAbstractItemView, QFrame
)
from PySide6.QtCore import Qt

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.ui.components.chart_view import ChartView
from app.database.connection import get_session
from app.database.models import Store
from app.core.analytics import AnalyticsService
from app.config import PLATFORM_CHOICES, PLATFORM_PROMOTION_FIELDS


class StoreEditDialog(QDialog):
    """店铺编辑对话框"""

    def __init__(self, store: Store = None, parent=None):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("编辑店铺" if store else "新增店铺")
        self.setMinimumWidth(450)

        layout = QFormLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(12)

        self.name_edit = QLineEdit(store.name if store else "")
        layout.addRow("店铺名称 *", self.name_edit)

        self.platform_combo = QComboBox()
        for code, label in PLATFORM_CHOICES:
            self.platform_combo.addItem(label, code)
        if store:
            idx = self.platform_combo.findData(store.platform)
            if idx >= 0:
                self.platform_combo.setCurrentIndex(idx)
        layout.addRow("平台 *", self.platform_combo)

        self.url_edit = QLineEdit(store.shop_url if store and store.shop_url else "")
        layout.addRow("店铺链接", self.url_edit)

        self.shop_id_edit = QLineEdit(store.shop_id if store and store.shop_id else "")
        layout.addRow("平台店铺 ID", self.shop_id_edit)

        self.contact_edit = QLineEdit(store.contact if store and store.contact else "")
        layout.addRow("联系人", self.contact_edit)

        self.active_check = QCheckBox("启用")
        self.active_check.setChecked(store.is_active if store else True)
        layout.addRow("状态", self.active_check)

        self.note_edit = QTextEdit(store.note if store and store.note else "")
        self.note_edit.setMaximumHeight(80)
        layout.addRow("备注", self.note_edit)

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

    def _on_save(self):
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, "提示", "请输入店铺名称")
            return
        self.accept()

    def get_data(self) -> dict:
        return {
            "name": self.name_edit.text().strip(),
            "platform": self.platform_combo.currentData(),
            "shop_url": self.url_edit.text().strip(),
            "shop_id": self.shop_id_edit.text().strip(),
            "contact": self.contact_edit.text().strip(),
            "is_active": self.active_check.isChecked(),
            "note": self.note_edit.toPlainText().strip(),
        }


class StoresPage(BasePage):
    title = "多店铺管理"
    subtitle = "支持淘宝/天猫/抖店/拼多多 多店铺管理"

    def __init__(self):
        super().__init__()

        # 工具栏
        toolbar = QHBoxLayout()
        toolbar.addStretch()

        add_btn = QPushButton("+ 新增店铺")
        add_btn.setObjectName("PrimaryButton")
        add_btn.clicked.connect(self._on_add_store)
        toolbar.addWidget(add_btn)

        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.refresh)
        toolbar.addWidget(refresh_btn)

        self._root_layout.addLayout(toolbar)

        # 店铺列表
        list_section = SectionCard("店铺列表", "支持新增 / 编辑 / 停用")
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(["ID", "店铺名称", "平台", "联系人", "状态", "创建时间", "操作"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(6, QHeaderView.ResizeToContents)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        list_section.add_widget(self.table)
        self.add_widget(list_section)

        # 多店铺对比
        compare_section = SectionCard("多店铺对比", "近 30 天销售/利润/ROI 对比")
        self.compare_chart = ChartView(height=320)
        compare_section.add_widget(self.compare_chart)
        self.add_widget(compare_section)

        self.add_stretch()

    def _on_add_store(self):
        dlg = StoreEditDialog(parent=self)
        if dlg.exec() == QDialog.Accepted:
            data = dlg.get_data()
            try:
                with get_session() as session:
                    store = Store(**data)
                    session.add(store)
                    session.commit()
                QMessageBox.information(self, "成功", "店铺创建成功")
                self.refresh()
            except Exception as e:
                QMessageBox.critical(self, "失败", f"创建失败: {e}")

    def _on_edit_store(self, store_id: int):
        with get_session() as session:
            store = session.get(Store, store_id)
            if not store:
                return
            dlg = StoreEditDialog(store=store, parent=self)
            if dlg.exec() == QDialog.Accepted:
                data = dlg.get_data()
                for k, v in data.items():
                    setattr(store, k, v)
                session.commit()
            QMessageBox.information(self, "成功", "店铺已更新")
        self.refresh()

    def _on_toggle_store(self, store_id: int):
        with get_session() as session:
            store = session.get(Store, store_id)
            if store:
                store.is_active = not store.is_active
                session.commit()
        self.refresh()

    def refresh(self):
        # 表格
        try:
            with get_session() as session:
                stores = list(session.query(Store).order_by(Store.id).all())

                self.table.setRowCount(len(stores))
                for row, s in enumerate(stores):
                    self.table.setItem(row, 0, QTableWidgetItem(str(s.id)))
                    self.table.setItem(row, 1, QTableWidgetItem(s.name))
                    platform_label = dict(PLATFORM_CHOICES).get(s.platform, s.platform)
                    self.table.setItem(row, 2, QTableWidgetItem(platform_label))
                    self.table.setItem(row, 3, QTableWidgetItem(s.contact or "-"))
                    status_item = QTableWidgetItem("启用" if s.is_active else "停用")
                    status_item.setForeground(Qt.green if s.is_active else Qt.gray)
                    self.table.setItem(row, 4, QTableWidgetItem(status_item))
                    self.table.setItem(row, 5, QTableWidgetItem(s.created_at.strftime("%Y-%m-%d") if s.created_at else "-"))

                    # 操作按钮
                    op_widget = QFrame()
                    op_layout = QHBoxLayout(op_widget)
                    op_layout.setContentsMargins(4, 4, 4, 4)
                    op_layout.setSpacing(4)

                    edit_btn = QPushButton("编辑")
                    edit_btn.setStyleSheet("padding: 2px 8px; font-size: 12px;")
                    edit_btn.clicked.connect(lambda checked=False, sid=s.id: self._on_edit_store(sid))
                    op_layout.addWidget(edit_btn)

                    toggle_btn = QPushButton("停用" if s.is_active else "启用")
                    toggle_btn.setStyleSheet("padding: 2px 8px; font-size: 12px;")
                    toggle_btn.clicked.connect(lambda checked=False, sid=s.id: self._on_toggle_store(sid))
                    op_layout.addWidget(toggle_btn)

                    self.table.setCellWidget(row, 6, op_widget)

                # 对比图
                svc = AnalyticsService(session)
                comparisons = svc.get_store_comparison(days=30)
                if comparisons:
                    names = [c.store_name for c in comparisons]
                    self.compare_chart.show_bar_chart(
                        "近 30 天多店铺对比",
                        x_data=names,
                        series=[
                            {"name": "销售额", "data": [c.sales for c in comparisons], "color": "#0071E3"},
                            {"name": "净利润", "data": [c.profit for c in comparisons], "color": "#34C759"},
                        ],
                    )
        except Exception as e:
            print(f"[ERROR] 刷新店铺列表失败: {e}")
