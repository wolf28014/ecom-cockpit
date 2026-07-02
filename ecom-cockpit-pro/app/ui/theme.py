"""
Apple Numbers 风主题样式表
"""
from PySide6.QtGui import QColor, QPalette
from PySide6.QtWidgets import QApplication

from app.config import THEME_COLORS


APPLE_QSS = """
/* ============== 全局 ============== */
QWidget {
    font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
    font-size: 14px;
    color: #1D1D1F;
}

QMainWindow, QWidget#rootWidget {
    background-color: #F5F5F7;
}

/* ============== 滚动条 ============== */
QScrollBar:vertical {
    background: transparent;
    width: 8px;
    margin: 0px;
}
QScrollBar::handle:vertical {
    background: #C7C7CC;
    border-radius: 4px;
    min-height: 30px;
}
QScrollBar::handle:vertical:hover {
    background: #8E8E93;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}
QScrollBar:horizontal {
    background: transparent;
    height: 8px;
    margin: 0px;
}
QScrollBar::handle:horizontal {
    background: #C7C7CC;
    border-radius: 4px;
    min-width: 30px;
}

/* ============== 卡片 ============== */
QFrame#CardWidget {
    background-color: #FFFFFF;
    border-radius: 12px;
    border: 1px solid #E5E5EA;
}
QFrame#CardWidget:hover {
    border-color: #D1D1D6;
}

/* ============== 标题 ============== */
QLabel#TitleLabel {
    font-size: 28px;
    font-weight: 700;
    color: #1D1D1F;
}
QLabel#SubtitleLabel {
    font-size: 16px;
    font-weight: 600;
    color: #1D1D1F;
}
QLabel#SectionLabel {
    font-size: 18px;
    font-weight: 600;
    color: #1D1D1F;
}
QLabel#CaptionLabel {
    font-size: 12px;
    color: #6E6E73;
}
QLabel#BigNumberLabel {
    font-size: 36px;
    font-weight: 700;
    color: #1D1D1F;
}
QLabel#MediumNumberLabel {
    font-size: 24px;
    font-weight: 700;
    color: #1D1D1F;
}
QLabel#AccentLabel {
    color: #0071E3;
    font-weight: 600;
}
QLabel#SuccessLabel {
    color: #34C759;
    font-weight: 600;
}
QLabel#DangerLabel {
    color: #FF3B30;
    font-weight: 600;
}
QLabel#WarningLabel {
    color: #FF9500;
    font-weight: 600;
}

/* ============== 按钮 ============== */
QPushButton {
    background-color: #FFFFFF;
    color: #0071E3;
    border: 1px solid #0071E3;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 500;
}
QPushButton:hover {
    background-color: #F0F7FF;
}
QPushButton:pressed {
    background-color: #E1EEFF;
}
QPushButton:disabled {
    color: #C7C7CC;
    border-color: #E5E5EA;
}

QPushButton#PrimaryButton {
    background-color: #0071E3;
    color: #FFFFFF;
    border: none;
}
QPushButton#PrimaryButton:hover {
    background-color: #0058B0;
}
QPushButton#PrimaryButton:pressed {
    background-color: #004A93;
}

QPushButton#DangerButton {
    background-color: #FF3B30;
    color: #FFFFFF;
    border: none;
}
QPushButton#DangerButton:hover {
    background-color: #D70015;
}

QPushButton#GhostButton {
    background-color: transparent;
    color: #0071E3;
    border: none;
}
QPushButton#GhostButton:hover {
    text-decoration: underline;
}

/* ============== 输入框 ============== */
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QDateEdit, QTextEdit {
    background-color: #FFFFFF;
    border: 1px solid #D1D1D6;
    border-radius: 8px;
    padding: 8px 12px;
    color: #1D1D1F;
    selection-background-color: #0071E3;
    selection-color: #FFFFFF;
}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus, QDateEdit:focus, QTextEdit:focus {
    border: 2px solid #0071E3;
    padding: 7px 11px;
}

/* ============== 表格 ============== */
QTableWidget {
    background-color: #FFFFFF;
    border: 1px solid #E5E5EA;
    border-radius: 8px;
    gridline-color: #F2F2F7;
    selection-background-color: #E1EEFF;
    selection-color: #1D1D1F;
}
QHeaderView::section {
    background-color: #F5F5F7;
    color: #6E6E73;
    padding: 10px 12px;
    border: none;
    border-right: 1px solid #E5E5EA;
    border-bottom: 1px solid #E5E5EA;
    font-weight: 600;
}
QTableWidget::item {
    padding: 8px 12px;
    border-bottom: 1px solid #F2F2F7;
}

/* ============== 标签页 ============== */
QTabWidget::pane {
    border: 1px solid #E5E5EA;
    border-radius: 8px;
    background-color: #FFFFFF;
}
QTabBar::tab {
    background-color: transparent;
    color: #6E6E73;
    padding: 8px 16px;
    border: none;
    font-weight: 500;
}
QTabBar::tab:selected {
    color: #0071E3;
    border-bottom: 2px solid #0071E3;
}
QTabBar::tab:hover:!selected {
    color: #1D1D1F;
}

/* ============== 进度条 ============== */
QProgressBar {
    background-color: #E5E5EA;
    border: none;
    border-radius: 4px;
    text-align: center;
    height: 8px;
}
QProgressBar::chunk {
    background-color: #0071E3;
    border-radius: 4px;
}
QProgressBar#SuccessProgress::chunk {
    background-color: #34C759;
}
QProgressBar#WarningProgress::chunk {
    background-color: #FF9500;
}
QProgressBar#DangerProgress::chunk {
    background-color: #FF3B30;
}

/* ============== 工具提示 ============== */
QToolTip {
    background-color: #1D1D1F;
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
}
"""


def apply_apple_theme(app: QApplication, dark: bool = False):
    """应用 Apple Numbers 风主题"""
    # 调色板
    palette = QPalette()
    if dark:
        colors = THEME_COLORS["dark"]
    else:
        colors = THEME_COLORS["light"]

    palette.setColor(QPalette.Window, QColor(colors["bg"]))
    palette.setColor(QPalette.WindowText, QColor(colors["text_primary"]))
    palette.setColor(QPalette.Base, QColor(colors["card_bg"]))
    palette.setColor(QPalette.AlternateBase, QColor(colors["bg"]))
    palette.setColor(QPalette.Text, QColor(colors["text_primary"]))
    palette.setColor(QPalette.Button, QColor(colors["card_bg"]))
    palette.setColor(QPalette.ButtonText, QColor(colors["text_primary"]))
    palette.setColor(QPalette.Highlight, QColor(colors["accent"]))
    palette.setColor(QPalette.HighlightedText, QColor("#FFFFFF"))
    app.setPalette(palette)

    # QSS
    app.setStyleSheet(APPLE_QSS)
