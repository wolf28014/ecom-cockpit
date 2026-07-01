"""
系统设置页
"""
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox, QLineEdit,
    QFormLayout, QGroupBox, QSpinBox, QCheckBox, QMessageBox, QFrame
)
from PySide6.QtCore import Qt

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.database.connection import get_session
from app.database.models import Setting
from app.config import ALERT_THRESHOLDS


class SettingsPage(BasePage):
    title = "系统设置"
    subtitle = "AI 配置 / 主题 / 预警阈值 / 公司信息"

    def __init__(self):
        super().__init__()

        # AI 设置
        ai_section = SectionCard("AI 配置", "GLM-4 大模型 API 设置")
        ai_form = QFormLayout()
        ai_form.setSpacing(12)

        self.ai_model_input = QLineEdit()
        self.ai_model_input.setPlaceholderText("glm-4-plus")
        ai_form.addRow("AI 模型", self.ai_model_input)

        self.ai_timeout_input = QSpinBox()
        self.ai_timeout_input.setRange(10, 300)
        self.ai_timeout_input.setSuffix(" 秒")
        ai_form.addRow("请求超时", self.ai_timeout_input)

        ai_status_label = QLabel("✅ z-ai CLI 已就绪")
        ai_status_label.setStyleSheet("color: #34C759; font-weight: 600;")
        ai_form.addRow("CLI 状态", ai_status_label)

        ai_section.add_layout(ai_form)
        self.add_widget(ai_section)

        # 公司信息
        company_section = SectionCard("公司信息", "用于报表抬头")
        company_form = QFormLayout()
        company_form.setSpacing(12)

        self.company_name_input = QLineEdit()
        company_form.addRow("公司名称", self.company_name_input)

        self.currency_input = QLineEdit()
        self.currency_input.setPlaceholderText("CNY")
        company_form.addRow("货币单位", self.currency_input)

        company_section.add_layout(company_form)
        self.add_widget(company_section)

        # 预警阈值
        alert_section = SectionCard("预警阈值", "调整异常检测的触发条件")
        alert_form = QFormLayout()
        alert_form.setSpacing(12)

        self.sales_decline_input = QSpinBox()
        self.sales_decline_input.setRange(1, 30)
        self.sales_decline_input.setSuffix(" 天")
        alert_form.addRow("销售连续下降预警", self.sales_decline_input)

        self.profit_decline_input = QSpinBox()
        self.profit_decline_input.setRange(5, 100)
        self.profit_decline_input.setSuffix(" %")
        alert_form.addRow("利润下降预警阈值", self.profit_decline_input)

        self.promo_roi_input = QSpinBox()
        self.promo_roi_input.setRange(0, 100)
        self.promo_roi_input.setSuffix(" (ROI)")
        alert_form.addRow("推广 ROI 偏低阈值", self.promo_roi_input)

        self.refund_rate_input = QSpinBox()
        self.refund_rate_input.setRange(1, 100)
        self.refund_rate_input.setSuffix(" %")
        alert_form.addRow("退款率过高阈值", self.refund_rate_input)

        self.promo_rate_input = QSpinBox()
        self.promo_rate_input.setRange(1, 100)
        self.promo_rate_input.setSuffix(" %")
        alert_form.addRow("推广费率过高阈值", self.promo_rate_input)

        alert_section.add_layout(alert_form)
        self.add_widget(alert_section)

        # 保存按钮
        btn_row = QHBoxLayout()
        btn_row.addStretch()

        save_btn = QPushButton("保存设置")
        save_btn.setObjectName("PrimaryButton")
        save_btn.setMinimumWidth(160)
        save_btn.clicked.connect(self._on_save)
        btn_row.addWidget(save_btn)

        self.add_layout(btn_row)
        self.add_stretch()

        self._load_settings()

    def _load_settings(self):
        try:
            with get_session() as session:
                def _get(key, default=""):
                    s = session.query(Setting).filter_by(key=key).first()
                    return s.value if s else default

                self.ai_model_input.setText(_get("ai_model", "glm-4-plus"))
                self.ai_timeout_input.setValue(int(_get("ai_timeout", "60")))
                self.company_name_input.setText(_get("company_name", "我的电商公司"))
                self.currency_input.setText(_get("currency", "CNY"))

                self.sales_decline_input.setValue(ALERT_THRESHOLDS["sales_decline_days"])
                self.profit_decline_input.setValue(int(ALERT_THRESHOLDS["profit_decline_pct"] * 100))
                self.promo_roi_input.setValue(int(ALERT_THRESHOLDS["promotion_roi_min"]))
                self.refund_rate_input.setValue(int(ALERT_THRESHOLDS["refund_rate_max"] * 100))
                self.promo_rate_input.setValue(int(ALERT_THRESHOLDS["promotion_rate_max"] * 100))

        except Exception as e:
            print(f"[WARN] 加载设置失败: {e}")

    def _on_save(self):
        try:
            with get_session() as session:
                settings = {
                    "ai_model": self.ai_model_input.text(),
                    "ai_timeout": str(self.ai_timeout_input.value()),
                    "company_name": self.company_name_input.text(),
                    "currency": self.currency_input.text(),
                }
                for k, v in settings.items():
                    s = session.query(Setting).filter_by(key=k).first()
                    if s:
                        s.value = v
                    else:
                        session.add(Setting(key=k, value=v))

                # 预警阈值（运行时生效，下次启动时持久化到 config）
                from app.config import ALERT_THRESHOLDS as _cfg
                _cfg["sales_decline_days"] = self.sales_decline_input.value()
                _cfg["profit_decline_pct"] = self.profit_decline_input.value() / 100
                _cfg["promotion_roi_min"] = self.promo_roi_input.value()
                _cfg["refund_rate_max"] = self.refund_rate_input.value() / 100
                _cfg["promotion_rate_max"] = self.promo_rate_input.value() / 100

                session.commit()

            QMessageBox.information(self, "成功", "设置已保存")
        except Exception as e:
            QMessageBox.critical(self, "失败", f"保存失败: {e}")

    def refresh(self):
        self._load_settings()
