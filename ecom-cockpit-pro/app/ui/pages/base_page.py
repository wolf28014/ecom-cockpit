"""
页面基类
"""
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel, QFrame, QScrollArea, QHBoxLayout, QSizePolicy

from app.database.connection import get_session


class BasePage(QWidget):
    """所有页面的基类"""

    title = "页面"
    subtitle = ""

    def __init__(self):
        super().__init__()
        self.setObjectName("PageWidget")
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        # 顶层 layout
        self._root_layout = QVBoxLayout(self)
        self._root_layout.setContentsMargins(32, 24, 32, 24)
        self._root_layout.setSpacing(16)

        # 标题栏
        self._init_header()

        # 内容容器（可滚动）
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.NoFrame)
        self._scroll.setStyleSheet("QScrollArea { background: transparent; }")

        self._content = QWidget()
        self._content.setStyleSheet("background: transparent;")
        self._content_layout = QVBoxLayout(self._content)
        self._content_layout.setContentsMargins(0, 0, 0, 0)
        self._content_layout.setSpacing(16)

        self._scroll.setWidget(self._content)
        self._root_layout.addWidget(self._scroll)

    def _init_header(self):
        """标题栏"""
        header = QFrame()
        header.setStyleSheet("background: transparent;")
        header_layout = QVBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 0)
        header_layout.setSpacing(4)

        self._title_label = QLabel(self.title)
        self._title_label.setStyleSheet("font-size: 28px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.5px;")
        header_layout.addWidget(self._title_label)

        if self.subtitle:
            self._subtitle_label = QLabel(self.subtitle)
            self._subtitle_label.setStyleSheet("font-size: 13px; color: #6E6E73;")
            header_layout.addWidget(self._subtitle_label)

        self._root_layout.addWidget(header)

    def add_widget(self, widget):
        """添加内容控件"""
        self._content_layout.addWidget(widget)

    def add_layout(self, layout):
        self._content_layout.addLayout(layout)

    def add_stretch(self):
        self._content_layout.addStretch()

    def refresh(self):
        """刷新数据（子类重写）"""
        pass

    def on_close(self):
        """关闭前回调（子类重写）"""
        pass
