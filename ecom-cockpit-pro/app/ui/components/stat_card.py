"""
统计卡片组件 - 用于次级数据展示
"""
from typing import Optional
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QVBoxLayout, QHBoxLayout, QLabel, QSizePolicy


class StatCard(QFrame):
    """统计卡片 - 比 KPI 卡片小，用于次级数据"""

    def __init__(self, title: str = "", value: str = "",
                 subtitle: str = "", color: str = "#1D1D1F", parent=None):
        super().__init__(parent)
        self.setObjectName("CardWidget")
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.setFixedHeight(90)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(2)

        self.title_label = QLabel(title)
        self.title_label.setStyleSheet("font-size: 12px; color: #6E6E73; font-weight: 500;")
        layout.addWidget(self.title_label)

        self.value_label = QLabel(value)
        self.value_label.setStyleSheet(f"font-size: 22px; color: {color}; font-weight: 700;")
        layout.addWidget(self.value_label)

        self.subtitle_label = QLabel(subtitle)
        self.subtitle_label.setStyleSheet("font-size: 11px; color: #8E8E93;")
        layout.addWidget(self.subtitle_label)

    def set_data(self, title: str, value: str, subtitle: str = "", color: str = "#1D1D1F"):
        self.title_label.setText(title)
        self.value_label.setText(value)
        self.value_label.setStyleSheet(f"font-size: 22px; color: {color}; font-weight: 700;")
        self.subtitle_label.setText(subtitle)
