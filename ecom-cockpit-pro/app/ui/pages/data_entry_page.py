"""
数据录入页
"""
from datetime import date, timedelta
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QTableWidget, QTableWidgetItem,
    QComboBox, QDateEdit, QSpinBox, QDoubleSpinBox, QLineEdit, QTextEdit,
    QFormLayout, QGroupBox, QFrame, QHeaderView, QAbstractItemView, QMessageBox,
    QSizePolicy, QScrollArea
)
from PySide6.QtCore import Qt, QDate

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.database.connection import get_session
from app.database.models import Store, DailyRecord
from app.core.analytics import AnalyticsService
from app.config import PLATFORM_PROMOTION_FIELDS, PLATFORM_CHOICES


class DataEntryPage(BasePage):
    title = "每日数据录入"
    subtitle = "录入销售/推广/成本数据，系统自动计算利润和 ROI"

    def __init__(self):
        super().__init__()

        self.current_store_id: Optional[int] = None

        # 顶部：店铺选择 + 日期
        toolbar = QHBoxLayout()

        toolbar.addWidget(QLabel("选择店铺:"))
        self.store_combo = QComboBox()
        self.store_combo.setMinimumWidth(220)
        self.store_combo.currentIndexChanged.connect(self._on_store_changed)
        toolbar.addWidget(self.store_combo)

        toolbar.addSpacing(16)
        toolbar.addWidget(QLabel("录入日期:"))
        self.date_edit = QDateEdit()
        self.date_edit.setDate(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("yyyy-MM-dd")
        toolbar.addWidget(self.date_edit)

        toolbar.addStretch()

        load_btn = QPushButton("加载已有数据")
        load_btn.clicked.connect(self._load_existing)
        toolbar.addWidget(load_btn)

        save_btn = QPushButton("保存数据")
        save_btn.setObjectName("PrimaryButton")
        save_btn.clicked.connect(self._save_data)
        toolbar.addWidget(save_btn)

        self._root_layout.addLayout(toolbar)

        # 三列布局：基础数据 + 推广数据 + 成本数据
        columns_layout = QHBoxLayout()
        columns_layout.setSpacing(16)

        # 左列：基础数据
        basic_section = SectionCard("基础经营数据", "销售/订单/退款")
        self._init_basic_form(basic_section)
        columns_layout.addWidget(basic_section)

        # 中列：推广数据
        promo_section = SectionCard("推广数据", "各推广渠道花费")
        self._init_promo_form(promo_section)
        columns_layout.addWidget(promo_section)

        # 右列：成本数据
        cost_section = SectionCard("成本数据", "商品/运费/包装/人工等")
        self._init_cost_form(cost_section)
        columns_layout.addWidget(cost_section)

        self.add_layout(columns_layout)

        # 自动计算结果
        result_section = SectionCard("自动计算结果", "保存后系统会自动计算以下指标")
        self._init_result_form(result_section)
        self.add_widget(result_section)

        self.add_stretch()

        # 加载店铺
        self._load_stores()

    def _init_basic_form(self, section: SectionCard):
        form = QFormLayout()
        form.setSpacing(10)

        self.sales_input = QDoubleSpinBox()
        self.sales_input.setRange(0, 99999999)
        self.sales_input.setDecimals(2)
        self.sales_input.setPrefix("¥ ")
        self.sales_input.valueChanged.connect(self._auto_calc)
        form.addRow("销售额", self.sales_input)

        self.orders_input = QSpinBox()
        self.orders_input.setRange(0, 999999)
        self.orders_input.valueChanged.connect(self._auto_calc)
        form.addRow("订单数", self.orders_input)

        self.refund_amount_input = QDoubleSpinBox()
        self.refund_amount_input.setRange(0, 99999999)
        self.refund_amount_input.setDecimals(2)
        self.refund_amount_input.setPrefix("¥ ")
        self.refund_amount_input.valueChanged.connect(self._auto_calc)
        form.addRow("退款金额", self.refund_amount_input)

        self.refund_orders_input = QSpinBox()
        self.refund_orders_input.setRange(0, 999999)
        self.refund_orders_input.valueChanged.connect(self._auto_calc)
        form.addRow("退款订单数", self.refund_orders_input)

        section.add_layout(form)

    def _init_promo_form(self, section: SectionCard):
        self.promo_inputs = {}
        self.promo_form = QFormLayout()
        self.promo_form.setSpacing(10)
        section.add_layout(self.promo_form)
        # 字段在 _on_store_changed 时动态生成

    def _init_cost_form(self, section: SectionCard):
        self.cost_inputs = {}
        cost_form = QFormLayout()
        cost_form.setSpacing(10)

        cost_fields = [
            ("goods_cost", "商品成本", "¥ "),
            ("shipping", "运费", "¥ "),
            ("package", "包装", "¥ "),
            ("labor", "人工", "¥ "),
            ("rent", "房租", "¥ "),
            ("other", "其他", "¥ "),
        ]
        for key, label, prefix in cost_fields:
            inp = QDoubleSpinBox()
            inp.setRange(0, 99999999)
            inp.setDecimals(2)
            inp.setPrefix(prefix)
            inp.valueChanged.connect(self._auto_calc)
            self.cost_inputs[key] = inp
            cost_form.addRow(label, inp)

        section.add_layout(cost_form)

    def _init_result_form(self, section: SectionCard):
        result_layout = QHBoxLayout()
        result_layout.setSpacing(16)

        self.result_labels = {}
        metrics = [
            ("gross_profit", "毛利润", "#34C759"),
            ("net_profit", "净利润", "#34C759"),
            ("profit_rate", "利润率", "#0071E3"),
            ("roi", "ROI", "#0071E3"),
            ("avg_order_value", "客单价", "#AF52DE"),
            ("profit_per_order", "单均利润", "#AF52DE"),
            ("refund_rate", "退款率", "#FF9500"),
            ("promotion_rate", "推广费率", "#FF9500"),
        ]
        for key, label, color in metrics:
            card = QFrame()
            card.setObjectName("CardWidget")
            card.setFixedHeight(80)
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(12, 8, 12, 8)

            title_lbl = QLabel(label)
            title_lbl.setStyleSheet("font-size: 11px; color: #6E6E73;")
            card_layout.addWidget(title_lbl)

            val_lbl = QLabel("-")
            val_lbl.setStyleSheet(f"font-size: 18px; color: {color}; font-weight: 700;")
            card_layout.addWidget(val_lbl)

            self.result_labels[key] = val_lbl
            result_layout.addWidget(card)

        section.add_layout(result_layout)

    def _load_stores(self):
        self.store_combo.blockSignals(True)
        self.store_combo.clear()
        try:
            with get_session() as session:
                stores = list(session.query(Store).filter(Store.is_active == True).order_by(Store.id).all())
                for s in stores:
                    self.store_combo.addItem(f"{s.name}", s.id)
        except Exception as e:
            print(f"[WARN] 加载店铺失败: {e}")
        self.store_combo.blockSignals(False)

        if self.store_combo.count() > 0:
            self.current_store_id = self.store_combo.itemData(0)
            self._rebuild_promo_fields()

    def _on_store_changed(self, idx: int):
        self.current_store_id = self.store_combo.itemData(idx)
        self._rebuild_promo_fields()

    def _rebuild_promo_fields(self):
        """根据店铺平台动态生成推广字段"""
        if not self.current_store_id:
            return

        # 清空旧字段
        while self.promo_form.count():
            item = self.promo_form.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self.promo_inputs.clear()

        # 获取平台推广字段
        with get_session() as session:
            store = session.get(Store, self.current_store_id)
            if not store:
                return
            fields = PLATFORM_PROMOTION_FIELDS.get(store.platform, ["其他"])

        # 生成新字段
        for field_name in fields:
            inp = QDoubleSpinBox()
            inp.setRange(0, 99999999)
            inp.setDecimals(2)
            inp.setPrefix("¥ ")
            inp.valueChanged.connect(self._auto_calc)
            self.promo_inputs[field_name] = inp
            self.promo_form.addRow(field_name, inp)

    def _load_existing(self):
        """加载已有数据"""
        if not self.current_store_id:
            QMessageBox.warning(self, "提示", "请先选择店铺")
            return

        target_date = self.date_edit.date().toPython()

        with get_session() as session:
            record = session.query(DailyRecord).filter(
                DailyRecord.store_id == self.current_store_id,
                DailyRecord.record_date == target_date,
            ).first()

            if not record:
                QMessageBox.information(self, "提示", "所选日期暂无数据，可录入新数据")
                return

            # 填充表单
            self.sales_input.setValue(record.sales_amount)
            self.orders_input.setValue(record.order_count)
            self.refund_amount_input.setValue(record.refund_amount)
            self.refund_orders_input.setValue(record.refund_order_count)

            # 推广数据
            promo_data = record.promotion_data or {}
            for name, inp in self.promo_inputs.items():
                inp.setValue(promo_data.get(name, 0))

            # 成本数据
            cost_data = record.cost_data or {}
            cost_keys = {"goods_cost": "商品成本", "shipping": "运费", "package": "包装", "labor": "人工", "rent": "房租", "other": "其他"}
            for key, inp in self.cost_inputs.items():
                inp.setValue(cost_data.get(cost_keys[key], 0))

            self._auto_calc()

    def _auto_calc(self):
        """自动计算指标"""
        sales = self.sales_input.value()
        orders = self.orders_input.value()
        refund_amount = self.refund_amount_input.value()
        refund_orders = self.refund_orders_input.value()
        promo_total = sum(inp.value() for inp in self.promo_inputs.values())
        goods_cost = self.cost_inputs["goods_cost"].value()
        shipping = self.cost_inputs["shipping"].value()
        package = self.cost_inputs["package"].value()
        labor = self.cost_inputs["labor"].value()
        rent = self.cost_inputs["rent"].value()
        other = self.cost_inputs["other"].value()

        gross = sales - goods_cost - refund_amount
        net = gross - promo_total - shipping - package - labor - rent - other
        profit_rate = net / sales if sales else 0
        roi = sales / promo_total if promo_total else 0
        aov = sales / orders if orders else 0
        ppo = net / orders if orders else 0
        refund_rate = refund_orders / orders if orders else 0
        promo_rate = promo_total / sales if sales else 0

        self.result_labels["gross_profit"].setText(f"¥{gross:,.2f}")
        self.result_labels["net_profit"].setText(f"¥{net:,.2f}")
        self.result_labels["profit_rate"].setText(f"{profit_rate*100:.1f}%")
        self.result_labels["roi"].setText(f"{roi:.2f}")
        self.result_labels["avg_order_value"].setText(f"¥{aov:.2f}")
        self.result_labels["profit_per_order"].setText(f"¥{ppo:.2f}")
        self.result_labels["refund_rate"].setText(f"{refund_rate*100:.1f}%")
        self.result_labels["promotion_rate"].setText(f"{promo_rate*100:.1f}%")

    def _save_data(self):
        if not self.current_store_id:
            QMessageBox.warning(self, "提示", "请先选择店铺")
            return

        target_date = self.date_edit.date().toPython()
        sales = self.sales_input.value()
        orders = self.orders_input.value()
        refund_amount = self.refund_amount_input.value()
        refund_orders = self.refund_orders_input.value()
        promo_data = {name: inp.value() for name, inp in self.promo_inputs.items()}
        promo_total = sum(promo_data.values())

        cost_data = {
            "商品成本": self.cost_inputs["goods_cost"].value(),
            "运费": self.cost_inputs["shipping"].value(),
            "包装": self.cost_inputs["package"].value(),
            "人工": self.cost_inputs["labor"].value(),
            "房租": self.cost_inputs["rent"].value(),
            "其他": self.cost_inputs["other"].value(),
        }
        cost_total = sum(cost_data.values())

        goods_cost = cost_data["商品成本"]
        shipping = cost_data["运费"]
        package = cost_data["包装"]
        labor = cost_data["人工"]
        rent = cost_data["房租"]
        other = cost_data["其他"]

        gross = sales - goods_cost - refund_amount
        net = gross - promo_total - shipping - package - labor - rent - other

        try:
            with get_session() as session:
                record = session.query(DailyRecord).filter(
                    DailyRecord.store_id == self.current_store_id,
                    DailyRecord.record_date == target_date,
                ).first()

                if record:
                    msg = "数据已更新"
                else:
                    record = DailyRecord(store_id=self.current_store_id, record_date=target_date)
                    session.add(record)
                    msg = "数据已新增"

                record.sales_amount = sales
                record.order_count = orders
                record.refund_amount = refund_amount
                record.refund_order_count = refund_orders
                record.promotion_data = promo_data
                record.promotion_total = promo_total
                record.cost_data = cost_data
                record.cost_total = cost_total
                record.gross_profit = round(gross, 2)
                record.net_profit = round(net, 2)
                record.profit_rate = round(net / sales, 4) if sales else 0
                record.roi = round(sales / promo_total, 2) if promo_total else 0
                record.avg_order_value = round(sales / orders, 2) if orders else 0
                record.profit_per_order = round(net / orders, 2) if orders else 0
                record.refund_rate = round(refund_orders / orders, 4) if orders else 0
                record.promotion_rate = round(promo_total / sales, 4) if sales else 0

                session.commit()

            QMessageBox.information(self, "成功", f"{msg}！\n净利润：¥{net:,.2f}")
        except Exception as e:
            QMessageBox.critical(self, "失败", f"保存失败: {e}")

    def refresh(self):
        self._load_stores()
