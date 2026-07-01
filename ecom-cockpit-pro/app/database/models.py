"""
数据库模型定义
=================
覆盖所有模块的数据结构：
- 店铺、SKU 基础数据
- 每日经营数据（销售/推广/成本/SKU 销售）
- 利润目标、现金流记录
- 预警、AI 报告、设置、备份记录
"""
from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Boolean, Text,
    ForeignKey, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from app.database.connection import Base


# ============== 店铺 ==============
class Store(Base):
    """店铺表"""
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="店铺名称")
    platform = Column(String(20), nullable=False, comment="平台: taobao/tmall/douyin/pinduoduo")
    shop_url = Column(String(255), comment="店铺链接")
    shop_id = Column(String(50), comment="平台店铺 ID")
    contact = Column(String(50), comment="联系人")
    note = Column(Text, comment="备注")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    daily_records = relationship("DailyRecord", back_populates="store", cascade="all, delete-orphan")
    skus = relationship("SKU", back_populates="store", cascade="all, delete-orphan")
    targets = relationship("ProfitTarget", back_populates="store", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_store_platform", "platform"),
    )


# ============== SKU ==============
class SKU(Base):
    """商品 SKU 表"""
    __tablename__ = "skus"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    sku_code = Column(String(50), nullable=False, comment="SKU 编码")
    sku_name = Column(String(200), nullable=False, comment="商品名称")
    category = Column(String(50), comment="类目")
    unit_cost = Column(Float, default=0, comment="单位成本")
    unit_price = Column(Float, default=0, comment="售价")
    stock = Column(Integer, default=0, comment="当前库存")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    store = relationship("Store", back_populates="skus")
    daily_skus = relationship("DailySKU", back_populates="sku", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("store_id", "sku_code", name="uq_store_sku"),
    )


# ============== 每日经营数据 ==============
class DailyRecord(Base):
    """
    每日经营数据 - 核心表
    一个店铺一天一条记录，包含销售/订单/退款/推广/成本/利润
    """
    __tablename__ = "daily_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    record_date = Column(Date, nullable=False, comment="记录日期")

    # ---- 销售数据 ----
    sales_amount = Column(Float, default=0, comment="销售额")
    order_count = Column(Integer, default=0, comment="订单数")
    refund_amount = Column(Float, default=0, comment="退款金额")
    refund_order_count = Column(Integer, default=0, comment="退款订单数")

    # ---- 推广数据（JSON 存储各项推广花费） ----
    promotion_data = Column(JSON, default=dict, comment="推广数据 JSON")
    promotion_total = Column(Float, default=0, comment="推广总花费")

    # ---- 成本数据（JSON 存储各项成本） ----
    cost_data = Column(JSON, default=dict, comment="成本数据 JSON")
    cost_total = Column(Float, default=0, comment="成本总额（不含推广）")

    # ---- 自动计算字段 ----
    gross_profit = Column(Float, default=0, comment="毛利润 = 销售额 - 商品成本 - 退款")
    net_profit = Column(Float, default=0, comment="净利润 = 毛利润 - 推广 - 其他成本")
    profit_rate = Column(Float, default=0, comment="净利润率 = 净利润 / 销售额")
    roi = Column(Float, default=0, comment="ROI = 销售额 / 推广总花费")
    avg_order_value = Column(Float, default=0, comment="客单价 = 销售额 / 订单数")
    profit_per_order = Column(Float, default=0, comment="单均利润 = 净利润 / 订单数")
    refund_rate = Column(Float, default=0, comment="退款率 = 退款订单数 / 订单数")
    promotion_rate = Column(Float, default=0, comment="推广费率 = 推广 / 销售额")

    note = Column(Text, comment="备注")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    store = relationship("Store", back_populates="daily_records")
    daily_skus = relationship("DailySKU", back_populates="daily_record", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("store_id", "record_date", name="uq_store_date"),
        Index("idx_daily_date", "record_date"),
    )


class DailySKU(Base):
    """每日 SKU 销售数据"""
    __tablename__ = "daily_skus"

    id = Column(Integer, primary_key=True, autoincrement=True)
    daily_record_id = Column(Integer, ForeignKey("daily_records.id"), nullable=False)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    record_date = Column(Date, nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)

    sales_amount = Column(Float, default=0)
    order_count = Column(Integer, default=0)
    refund_amount = Column(Float, default=0)
    refund_order_count = Column(Integer, default=0)
    quantity = Column(Integer, default=0, comment="销售件数")
    cost = Column(Float, default=0, comment="商品成本")

    # 自动计算
    gross_profit = Column(Float, default=0)
    roi = Column(Float, default=0)
    refund_rate = Column(Float, default=0)

    daily_record = relationship("DailyRecord", back_populates="daily_skus")
    sku = relationship("SKU", back_populates="daily_skus")

    __table_args__ = (
        UniqueConstraint("daily_record_id", "sku_id", name="uq_daily_sku"),
        Index("idx_daily_sku_date", "record_date", "store_id"),
    )


# ============== 利润目标 ==============
class ProfitTarget(Base):
    """利润目标"""
    __tablename__ = "profit_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, comment="店铺 ID，0=全店汇总")
    target_type = Column(String(20), nullable=False, comment="yearly/quarterly/monthly")
    target_year = Column(Integer, nullable=False)
    target_quarter = Column(Integer, comment="季度 1-4")
    target_month = Column(Integer, comment="月份 1-12")
    target_amount = Column(Float, default=0, comment="目标利润金额")
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    store = relationship("Store", back_populates="targets")

    __table_args__ = (
        Index("idx_target_lookup", "store_id", "target_type", "target_year"),
    )


# ============== 现金流 ==============
class CashFlow(Base):
    """现金流记录"""
    __tablename__ = "cash_flows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    record_date = Column(Date, nullable=False)
    flow_type = Column(String(20), nullable=False, comment="income/expense")
    amount = Column(Float, default=0)
    description = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("idx_cashflow_date", "record_date"),
    )


# ============== 预警 ==============
class Alert(Base):
    """异常预警"""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), comment="店铺 ID，0=全局")
    alert_type = Column(String(50), nullable=False, comment="预警类型")
    level = Column(String(20), nullable=False, comment="info/warning/critical")
    title = Column(String(200), nullable=False)
    content = Column(Text)
    triggered_at = Column(DateTime, default=datetime.now)
    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)

    __table_args__ = (
        Index("idx_alert_time", "triggered_at"),
    )


# ============== AI 报告 ==============
class AIReport(Base):
    """AI 生成的经营报告"""
    __tablename__ = "ai_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    report_type = Column(String(20), nullable=False, comment="daily/weekly/monthly/yearly/suggestion")
    period_start = Column(Date)
    period_end = Column(Date)
    title = Column(String(200))
    content = Column(Text, comment="报告正文（Markdown）")
    summary = Column(Text, comment="报告摘要")
    model = Column(String(50), default="glm-4-plus")
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("idx_ai_report", "store_id", "report_type", "created_at"),
    )


class ChatHistory(Base):
    """老板助手聊天历史"""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, default=0, comment="店铺 ID，0=全局")
    role = Column(String(20), nullable=False, comment="user/assistant")
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


# ============== 系统设置 ==============
class Setting(Base):
    """系统设置（键值对）"""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False, unique=True)
    value = Column(Text)
    description = Column(String(200))
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# ============== 备份记录 ==============
class BackupRecord(Base):
    """数据库备份记录"""
    __tablename__ = "backup_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    backup_type = Column(String(20), nullable=False, comment="manual/auto_weekly/auto_daily/cloud")
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    status = Column(String(20), default="success", comment="success/failed")
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
