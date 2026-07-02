"""
Section 卡片组件 - 带标题的内容卡片
"""
from typing import Optional
from PySide6.QtWidgets import QFrame, QVBoxLayout, QHBoxLayout, QLabel, QWidget, QSizePolicy


class SectionCard(QFrame):
    """带标题的内容区卡片"""

    def __init__(self, title: str = "", subtitle: str = "", parent=None):
        super().__init__(parent)
        self.setObjectName("CardWidget")
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(24, 20, 24, 20)
        self._layout.setSpacing(12)

        # 标题栏
        if title:
            header_layout = QHBoxLayout()
            header_layout.setSpacing(8)

            self.title_label = QLabel(title)
            self.title_label.setStyleSheet("font-size: 18px; font-weight: 700; color: #1D1D1F;")
            header_layout.addWidget(self.title_label)

            if subtitle:
                self.subtitle_label = QLabel(subtitle)
                self.subtitle_label.setStyleSheet("font-size: 12px; color: #6E6E73;")
                header_layout.addWidget(self.subtitle_label)

            header_layout.addStretch()
            self._header_layout = header_layout
            self._layout.addLayout(header_layout)
        else:
            self._header_layout = None

        # 内容容器
        self._content = QWidget()
        self._content_layout = QVBoxLayout(self._content)
        self._content_layout.setContentsMargins(0, 0, 0, 0)
        self._content_layout.setSpacing(8)
        self._layout.addWidget(self._content)

    def add_widget(self, widget: QWidget):
        self._content_layout.addWidget(widget)

    def add_layout(self, layout):
        self._content_layout.addLayout(layout)

    def add_stretch(self):
        self._content_layout.addStretch()
