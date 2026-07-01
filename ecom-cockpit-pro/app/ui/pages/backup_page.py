"""
数据备份页
"""
from datetime import datetime
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QTableWidget,
    QTableWidgetItem, QHeaderView, QAbstractItemView, QMessageBox,
    QFrame, QComboBox
)
from PySide6.QtCore import Qt

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.database.connection import get_session
from app.core.backup import BackupService


class BackupPage(BasePage):
    title = "数据备份"
    subtitle = "手动 / 自动备份，支持恢复"

    def __init__(self):
        super().__init__()

        # 操作区
        action_section = SectionCard("备份操作", "立即创建备份或清理旧备份")

        btn_layout = QHBoxLayout()

        backup_btn = QPushButton("立即备份")
        backup_btn.setObjectName("PrimaryButton")
        backup_btn.clicked.connect(self._on_backup)
        btn_layout.addWidget(backup_btn)

        cleanup_btn = QPushButton("清理旧备份（保留最近 30 个）")
        cleanup_btn.clicked.connect(self._on_cleanup)
        btn_layout.addWidget(cleanup_btn)

        btn_layout.addStretch()

        # 备份位置显示
        from app.config import BACKUP_DIR, DB_PATH
        info_label = QLabel(f"📁 数据库位置: {DB_PATH}\n📁 备份目录: {BACKUP_DIR}")
        info_label.setStyleSheet("color: #6E6E73; font-size: 12px;")
        info_label.setWordWrap(True)
        btn_layout.addWidget(info_label)

        action_section.add_layout(btn_layout)
        self.add_widget(action_section)

        # 备份列表
        list_section = SectionCard("备份记录", "所有手动和自动备份")
        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(["ID", "类型", "文件路径", "大小", "时间", "操作"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeToContents)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        list_section.add_widget(self.table)
        self.add_widget(list_section)

        # 自动备份设置
        auto_section = SectionCard("自动备份设置", "选择自动备份频率")
        auto_layout = QHBoxLayout()
        auto_layout.addWidget(QLabel("备份频率:"))
        self.freq_combo = QComboBox()
        for code, label in [("daily", "每天"), ("weekly", "每周"), ("off", "关闭")]:
            self.freq_combo.addItem(label, code)
        auto_layout.addWidget(self.freq_combo)
        auto_layout.addStretch()
        save_freq_btn = QPushButton("保存")
        save_freq_btn.clicked.connect(self._save_freq)
        auto_layout.addWidget(save_freq_btn)
        auto_section.add_layout(auto_layout)
        self.add_widget(auto_section)

        self.add_stretch()

        self.refresh()
        self._load_freq()

    def _load_freq(self):
        try:
            with get_session() as session:
                from app.database.models import Setting
                s = session.query(Setting).filter_by(key="auto_backup").first()
                if s:
                    idx = self.freq_combo.findData(s.value)
                    if idx >= 0:
                        self.freq_combo.setCurrentIndex(idx)
        except Exception:
            pass

    def _save_freq(self):
        freq = self.freq_combo.currentData()
        try:
            with get_session() as session:
                from app.database.models import Setting
                s = session.query(Setting).filter_by(key="auto_backup").first()
                if s:
                    s.value = freq
                else:
                    session.add(Setting(key="auto_backup", value=freq, description="自动备份频率"))
                session.commit()
            QMessageBox.information(self, "成功", f"自动备份已设置为: {self.freq_combo.currentText()}")
        except Exception as e:
            QMessageBox.critical(self, "失败", f"保存失败: {e}")

    def _on_backup(self):
        try:
            with get_session() as session:
                svc = BackupService(session)
                record = svc.backup("manual", "手动备份")
            QMessageBox.information(self, "成功", f"备份已创建\n\n文件: {record.file_path}")
            self.refresh()
        except Exception as e:
            QMessageBox.critical(self, "失败", f"备份失败: {e}")

    def _on_cleanup(self):
        reply = QMessageBox.question(self, "确认", "确定清理旧备份，仅保留最近 30 个？")
        if reply != QMessageBox.Yes:
            return
        try:
            with get_session() as session:
                svc = BackupService(session)
                count = svc.cleanup_old_backups(keep_count=30)
            QMessageBox.information(self, "成功", f"已清理 {count} 个旧备份")
            self.refresh()
        except Exception as e:
            QMessageBox.critical(self, "失败", f"清理失败: {e}")

    def _on_restore(self, backup_id: int):
        reply = QMessageBox.question(self, "确认恢复", "恢复将覆盖当前数据，并自动创建当前数据的备份。确认继续？")
        if reply != QMessageBox.Yes:
            return
        try:
            with get_session() as session:
                svc = BackupService(session)
                if svc.restore(backup_id):
                    QMessageBox.information(self, "成功", "数据已恢复，请重启应用")
                else:
                    QMessageBox.warning(self, "失败", "恢复失败：备份文件不存在")
            self.refresh()
        except Exception as e:
            QMessageBox.critical(self, "失败", f"恢复失败: {e}")

    def _on_delete(self, backup_id: int):
        reply = QMessageBox.question(self, "确认删除", "确定删除该备份？")
        if reply != QMessageBox.Yes:
            return
        try:
            with get_session() as session:
                svc = BackupService(session)
                svc.delete_backup(backup_id)
            self.refresh()
        except Exception as e:
            QMessageBox.critical(self, "失败", f"删除失败: {e}")

    def refresh(self):
        try:
            with get_session() as session:
                svc = BackupService(session)
                backups = svc.list_backups()

                self.table.setRowCount(len(backups))
                for row, b in enumerate(backups):
                    self.table.setItem(row, 0, QTableWidgetItem(str(b.id)))
                    type_label = {"manual": "手动", "auto_daily": "自动日", "auto_weekly": "自动周",
                                  "pre_restore": "恢复前", "cloud": "云备份"}.get(b.backup_type, b.backup_type)
                    self.table.setItem(row, 1, QTableWidgetItem(type_label))
                    self.table.setItem(row, 2, QTableWidgetItem(b.file_path))
                    self.table.setItem(row, 3, QTableWidgetItem(f"{b.file_size/1024:.1f} KB"))
                    self.table.setItem(row, 4, QTableWidgetItem(b.created_at.strftime("%Y-%m-%d %H:%M")))

                    # 操作
                    op_widget = QFrame()
                    op_layout = QHBoxLayout(op_widget)
                    op_layout.setContentsMargins(4, 4, 4, 4)
                    op_layout.setSpacing(4)

                    restore_btn = QPushButton("恢复")
                    restore_btn.setStyleSheet("padding: 2px 8px; font-size: 12px;")
                    restore_btn.clicked.connect(lambda checked=False, bid=b.id: self._on_restore(bid))
                    op_layout.addWidget(restore_btn)

                    del_btn = QPushButton("删除")
                    del_btn.setStyleSheet("padding: 2px 8px; font-size: 12px; color: #FF3B30;")
                    del_btn.clicked.connect(lambda checked=False, bid=b.id: self._on_delete(bid))
                    op_layout.addWidget(del_btn)

                    self.table.setCellWidget(row, 5, op_widget)

        except Exception as e:
            print(f"[ERROR] 备份页刷新失败: {e}")
