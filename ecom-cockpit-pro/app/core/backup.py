"""
数据备份服务
"""
import shutil
import os
from datetime import datetime
from pathlib import Path
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import DB_PATH, BACKUP_DIR
from app.database.models import BackupRecord


class BackupService:
    """数据备份服务"""

    def __init__(self, session: Session):
        self.session = session

    def backup(self, backup_type: str = "manual", note: str = "") -> BackupRecord:
        """执行备份"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"ecom_cockpit_{backup_type}_{timestamp}.db"
        backup_path = BACKUP_DIR / backup_filename

        try:
            # 复制数据库文件
            shutil.copy2(DB_PATH, backup_path)
            file_size = backup_path.stat().st_size

            record = BackupRecord(
                backup_type=backup_type,
                file_path=str(backup_path),
                file_size=file_size,
                status="success",
                note=note or f"{backup_type} 备份",
            )
        except Exception as e:
            record = BackupRecord(
                backup_type=backup_type,
                file_path=str(backup_path),
                file_size=0,
                status="failed",
                note=f"备份失败: {str(e)}",
            )

        self.session.add(record)
        self.session.commit()
        return record

    def restore(self, backup_id: int) -> bool:
        """从备份恢复"""
        record = self.session.get(BackupRecord, backup_id)
        if not record or not Path(record.file_path).exists():
            return False

        # 先备份当前数据库
        self.backup("pre_restore", "恢复前自动备份")

        # 复制备份文件到当前数据库
        shutil.copy2(record.file_path, DB_PATH)
        return True

    def list_backups(self, limit: int = 50) -> List[BackupRecord]:
        return list(self.session.scalars(
            select(BackupRecord).order_by(BackupRecord.created_at.desc()).limit(limit)
        ).all())

    def delete_backup(self, backup_id: int) -> bool:
        record = self.session.get(BackupRecord, backup_id)
        if not record:
            return False
        try:
            Path(record.file_path).unlink(missing_ok=True)
        except Exception:
            pass
        self.session.delete(record)
        self.session.commit()
        return True

    def cleanup_old_backups(self, keep_count: int = 30):
        """清理旧备份，保留最近 N 个"""
        backups = self.list_backups(limit=1000)
        if len(backups) <= keep_count:
            return 0
        to_delete = backups[keep_count:]
        for r in to_delete:
            try:
                Path(r.file_path).unlink(missing_ok=True)
            except Exception:
                pass
            self.session.delete(r)
        self.session.commit()
        return len(to_delete)
