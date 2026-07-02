"""
KPI 卡片组件 - Apple Numbers 风
"""
from typing import Optional
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QFrame, QVBoxLayout, QHBoxLayout, QLabel, QSizePolicy
)


class KPICard(QFrame):
    """单个 KPI 卡片 - 显示一个核心指标"""

    def __init__(self, title: str = "", value: str = "",
                 subtitle: str = "", trend: Optional[float] = None,
                 trend_label: str = "环比", accent: str = "#0071E3",
                 parent=None):
        super().__init__(parent)
        self.setObjectName("CardWidget")
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.setFixedHeight(120)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(4)

        # 标题
        self.title_label = QLabel(title)
        self.title_label.setStyleSheet(f"font-size: 13px; color: #6E6E73; font-weight: 500;")
        layout.addWidget(self.title_label)

        # 大数字
        self.value_label = QLabel(value)
        self.value_label.setStyleSheet(f"font-size: 28px; color: {accent}; font-weight: 700; letter-spacing: -0.5px;")
        layout.addWidget(self.value_label)

        # 副标题 / 趋势
        bottom_layout = QHBoxLayout()
        bottom_layout.setSpacing(8)

        self.subtitle_label = QLabel(subtitle)
        self.subtitle_label.setStyleSheet("font-size: 12px; color: #6E6E73;")
        bottom_layout.addWidget(self.subtitle_label)
        bottom_layout.addStretch()

        self.trend_label = QLabel("")
        self.trend_label.setStyleSheet("font-size: 12px; font-weight: 600;")
        bottom_layout.addWidget(self.trend_label)

        layout.addLayout(bottom_layout)

        # 初始数据
        self.set_data(title, value, subtitle, trend, trend_label, accent)

    def set_data(self, title: str, value: str, subtitle: str = "",
                 trend: Optional[float] = None, trend_label: str = "环比",
                 accent: str = "#0071E3"):
        self.title_label.setText(title)
        self.value_label.setText(value)
        self.value_label.setStyleSheet(f"font-size: 28px; color: {accent}; font-weight: 700; letter-spacing: -0.5px;")
        self.subtitle_label.setText(subtitle)

        if trend is not None:
            pct = trend * 100
            if trend > 0:
                self.trend_label.setText(f"▲ {trend_label} +{pct:.1f}%")
                self.trend_label.setStyleSheet("font-size: 12px; color: #34C759; font-weight: 600;")
            elif trend < 0:
                self.trend_label.setText(f"▼ {trend_label} {pct:.1f}%")
                self.trend_label.setStyleSheet("font-size: 12px; color: #FF3B30; font-weight: 600;")
            else:
                self.trend_label.setText(f"— {trend_label} 0%")
                self.trend_label.setStyleSheet("font-size: 12px; color: #6E6E73; font-weight: 600;")
        else:
            self.trend_label.setText("")


class KPICardRow(QFrame):
    """KPI 卡片横向排列（自动撑满）"""

    def __init__(self, cards: list = None, parent=None):
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(16)
        if cards:
            for card in cards:
                layout.addWidget(card)

    def add_card(self, card: KPICard):
        self.layout().addWidget(card)
