"""
经营分析服务
================
提供所有统计/聚合/趋势分析功能，供 UI 层调用。
"""
from datetime import date, timedelta, datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.database.models import (
    Store, DailyRecord, DailySKU, SKU,
    ProfitTarget, Alert
)
from app.config import ALERT_THRESHOLDS


# ============== 数据类 ==============
@dataclass
class PeriodSummary:
    """周期汇总数据"""
    period: str  # today/week/month/year/custom
    sales_amount: float = 0
    order_count: int = 0
    refund_amount: float = 0
    refund_order_count: int = 0
    refund_rate: float = 0
    promotion_total: float = 0
    cost_total: float = 0
    gross_profit: float = 0
    net_profit: float = 0
    profit_rate: float = 0
    roi: float = 0
    avg_order_value: float = 0
    profit_per_order: float = 0
    promotion_rate: float = 0
    days: int = 0


@dataclass
class TrendPoint:
    """趋势数据点"""
    date: str
    sales: float = 0
    profit: float = 0
    orders: int = 0
    promotion: float = 0
    cost: float = 0
    refund: float = 0
    roi: float = 0
    profit_rate: float = 0


@dataclass
class SKUStat:
    """SKU 统计"""
    sku_id: int
    sku_code: str
    sku_name: str
    category: str
    sales_amount: float = 0
    quantity: int = 0
    order_count: int = 0
    cost: float = 0
    gross_profit: float = 0
    refund_amount: float = 0
    refund_rate: float = 0
    roi: float = 0
    stock: int = 0


@dataclass
class StoreComparison:
    """店铺对比"""
    store_id: int
    store_name: str
    platform: str
    sales: float = 0
    profit: float = 0
    orders: int = 0
    profit_rate: float = 0
    roi: float = 0
    refund_rate: float = 0


# ============== 主服务类 ==============
class AnalyticsService:
    """经营分析服务"""

    def __init__(self, session: Session):
        self.session = session

    # ---------- 周期汇总 ----------
    def get_today_summary(self, store_id: int = 0) -> PeriodSummary:
        """今日概览"""
        return self._get_period_summary(store_id, date.today(), date.today(), "today")

    def get_week_summary(self, store_id: int = 0) -> PeriodSummary:
        """本周概览（周一到今天）"""
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        return self._get_period_summary(store_id, monday, today, "week")

    def get_month_summary(self, store_id: int = 0) -> PeriodSummary:
        """本月概览"""
        today = date.today()
        first_day = today.replace(day=1)
        return self._get_period_summary(store_id, first_day, today, "month")

    def get_year_summary(self, store_id: int = 0) -> PeriodSummary:
        """本年概览"""
        today = date.today()
        first_day = today.replace(month=1, day=1)
        return self._get_period_summary(store_id, first_day, today, "year")

    def get_custom_summary(self, store_id: int, start: date, end: date) -> PeriodSummary:
        """自定义区间汇总"""
        return self._get_period_summary(store_id, start, end, "custom")

    def _get_period_summary(self, store_id: int, start: date, end: date, period: str) -> PeriodSummary:
        """内部：聚合指定区间的数据"""
        query = select(
            func.sum(DailyRecord.sales_amount).label("sales"),
            func.sum(DailyRecord.order_count).label("orders"),
            func.sum(DailyRecord.refund_amount).label("refund"),
            func.sum(DailyRecord.refund_order_count).label("refund_orders"),
            func.sum(DailyRecord.promotion_total).label("promotion"),
            func.sum(DailyRecord.cost_total).label("cost"),
            func.sum(DailyRecord.gross_profit).label("gross"),
            func.sum(DailyRecord.net_profit).label("net"),
            func.count(DailyRecord.id).label("days"),
        ).where(
            DailyRecord.record_date >= start,
            DailyRecord.record_date <= end,
        )
        if store_id and store_id > 0:
            query = query.where(DailyRecord.store_id == store_id)

        row = self.session.execute(query).first()
        if not row or not row.days:
            return PeriodSummary(period=period, days=0)

        sales = float(row.sales or 0)
        orders = int(row.orders or 0)
        refund = float(row.refund or 0)
        refund_orders = int(row.refund_orders or 0)
        promotion = float(row.promotion or 0)
        cost = float(row.cost or 0)
        gross = float(row.gross or 0)
        net = float(row.net or 0)
        days = int(row.days or 1)

        return PeriodSummary(
            period=period,
            sales_amount=round(sales, 2),
            order_count=orders,
            refund_amount=round(refund, 2),
            refund_order_count=refund_orders,
            refund_rate=round(refund_orders / orders, 4) if orders else 0,
            promotion_total=round(promotion, 2),
            cost_total=round(cost, 2),
            gross_profit=round(gross, 2),
            net_profit=round(net, 2),
            profit_rate=round(net / sales, 4) if sales else 0,
            roi=round(sales / promotion, 2) if promotion else 0,
            avg_order_value=round(sales / orders, 2) if orders else 0,
            profit_per_order=round(net / orders, 2) if orders else 0,
            promotion_rate=round(promotion / sales, 4) if sales else 0,
            days=days,
        )

    # ---------- 环比/同比 ----------
    def get_mom_change(self, store_id: int = 0) -> Dict[str, float]:
        """环比变化（本月 vs 上月同期）"""
        today = date.today()
        this_start = today.replace(day=1)
        this_end = today
        # 上月同期
        if today.month == 1:
            last_start = today.replace(year=today.year - 1, month=12, day=1)
            last_end = last_start.replace(day=today.day)
        else:
            last_start = today.replace(month=today.month - 1, day=1)
            last_end = last_start.replace(day=today.day)

        this_s = self._get_period_summary(store_id, this_start, this_end, "this_month")
        last_s = self._get_period_summary(store_id, last_start, last_end, "last_month")

        return self._calc_change(this_s, last_s)

    def get_yoy_change(self, store_id: int = 0) -> Dict[str, float]:
        """同比变化（今年 vs 去年同期）"""
        today = date.today()
        this_start = today.replace(month=1, day=1)
        this_end = today
        last_start = today.replace(year=today.year - 1, month=1, day=1)
        last_end = today.replace(year=today.year - 1)

        this_s = self._get_period_summary(store_id, this_start, this_end, "this_year")
        last_s = self._get_period_summary(store_id, last_start, last_end, "last_year")

        return self._calc_change(this_s, last_s)

    def _calc_change(self, this: PeriodSummary, last: PeriodSummary) -> Dict[str, float]:
        """计算变化率"""
        def _rate(t, l):
            if l == 0:
                return 0.0 if t == 0 else 1.0
            return round((t - l) / l, 4)
        return {
            "sales_change": _rate(this.sales_amount, last.sales_amount),
            "profit_change": _rate(this.net_profit, last.net_profit),
            "orders_change": _rate(this.order_count, last.order_count),
            "roi_change": _rate(this.roi, last.roi),
            "last_sales": last.sales_amount,
            "last_profit": last.net_profit,
            "this_sales": this.sales_amount,
            "this_profit": this.net_profit,
        }

    # ---------- 趋势 ----------
    def get_trend(self, store_id: int = 0, days: int = 30) -> List[TrendPoint]:
        """获取最近 N 天的趋势"""
        end = date.today()
        start = end - timedelta(days=days - 1)

        query = select(DailyRecord).where(
            DailyRecord.record_date >= start,
            DailyRecord.record_date <= end,
        )
        if store_id and store_id > 0:
            query = query.where(DailyRecord.store_id == store_id)
        query = query.order_by(DailyRecord.record_date.asc())

        records = self.session.scalars(query).all()

        # 按日期聚合（多店铺汇总）
        daily_map: Dict[str, TrendPoint] = {}
        for r in records:
            key = r.record_date.isoformat()
            if key not in daily_map:
                daily_map[key] = TrendPoint(
                    date=key,
                    sales=0, profit=0, orders=0,
                    promotion=0, cost=0, refund=0,
                    roi=0, profit_rate=0
                )
            p = daily_map[key]
            p.sales += r.sales_amount
            p.profit += r.net_profit
            p.orders += r.order_count
            p.promotion += r.promotion_total
            p.cost += r.cost_total
            p.refund += r.refund_amount

        # 计算 ROI 和利润率
        result = []
        for p in daily_map.values():
            p.roi = round(p.sales / p.promotion, 2) if p.promotion else 0
            p.profit_rate = round(p.profit / p.sales, 4) if p.sales else 0
            p.sales = round(p.sales, 2)
            p.profit = round(p.profit, 2)
            p.promotion = round(p.promotion, 2)
            p.cost = round(p.cost, 2)
            p.refund = round(p.refund, 2)
            result.append(p)
        return result

    # ---------- SKU 分析 ----------
    def get_sku_stats(self, store_id: int = 0, days: int = 30) -> List[SKUStat]:
        """获取 SKU 统计（最近 N 天）"""
        end = date.today()
        start = end - timedelta(days=days - 1)

        query = select(
            DailySKU.sku_id,
            SKU.sku_code,
            SKU.sku_name,
            SKU.category,
            SKU.stock,
            func.sum(DailySKU.sales_amount).label("sales"),
            func.sum(DailySKU.quantity).label("qty"),
            func.sum(DailySKU.order_count).label("orders"),
            func.sum(DailySKU.cost).label("cost"),
            func.sum(DailySKU.gross_profit).label("gross"),
            func.sum(DailySKU.refund_amount).label("refund"),
        ).join(
            SKU, DailySKU.sku_id == SKU.id
        ).where(
            DailySKU.record_date >= start,
            DailySKU.record_date <= end,
        )
        if store_id and store_id > 0:
            query = query.where(DailySKU.store_id == store_id)
        query = query.group_by(DailySKU.sku_id).order_by(func.sum(DailySKU.sales_amount).desc())

        rows = self.session.execute(query).all()
        stats = []
        for row in rows:
            sales = float(row.sales or 0)
            cost = float(row.cost or 0)
            orders = int(row.orders or 0)
            refund = float(row.refund or 0)
            stats.append(SKUStat(
                sku_id=row.sku_id,
                sku_code=row.sku_code,
                sku_name=row.sku_name,
                category=row.category or "",
                sales_amount=round(sales, 2),
                quantity=int(row.qty or 0),
                order_count=orders,
                cost=round(cost, 2),
                gross_profit=round(float(row.gross or 0), 2),
                refund_amount=round(refund, 2),
                refund_rate=round(refund / sales, 4) if sales else 0,
                roi=round(sales / cost, 2) if cost else 0,
                stock=int(row.stock or 0),
            ))
        return stats

    # ---------- 店铺对比 ----------
    def get_store_comparison(self, days: int = 30) -> List[StoreComparison]:
        """多店铺对比"""
        end = date.today()
        start = end - timedelta(days=days - 1)

        stores = self.session.scalars(select(Store).where(Store.is_active == True)).all()
        results = []
        for store in stores:
            query = select(
                func.sum(DailyRecord.sales_amount),
                func.sum(DailyRecord.net_profit),
                func.sum(DailyRecord.order_count),
                func.sum(DailyRecord.refund_amount),
                func.sum(DailyRecord.refund_order_count),
                func.sum(DailyRecord.promotion_total),
            ).where(
                DailyRecord.store_id == store.id,
                DailyRecord.record_date >= start,
                DailyRecord.record_date <= end,
            )
            row = self.session.execute(query).first()
            if not row:
                continue
            sales = float(row[0] or 0)
            profit = float(row[1] or 0)
            orders = int(row[2] or 0)
            refund = float(row[3] or 0)
            refund_orders = int(row[4] or 0)
            promotion = float(row[5] or 0)

            results.append(StoreComparison(
                store_id=store.id,
                store_name=store.name,
                platform=store.platform,
                sales=round(sales, 2),
                profit=round(profit, 2),
                orders=orders,
                profit_rate=round(profit / sales, 4) if sales else 0,
                roi=round(sales / promotion, 2) if promotion else 0,
                refund_rate=round(refund_orders / orders, 4) if orders else 0,
            ))
        return results

    # ---------- 利润目标 ----------
    def get_profit_target_progress(self, store_id: int = 0) -> Dict[str, Any]:
        """利润目标完成进度"""
        today = date.today()
        result = {}

        # 年度目标
        yearly_target = self.session.scalar(
            select(ProfitTarget).where(
                ProfitTarget.target_type == "yearly",
                ProfitTarget.target_year == today.year,
                (ProfitTarget.store_id == store_id) if store_id else True,
            )
        )
        if yearly_target:
            year_summary = self.get_year_summary(store_id)
            result["yearly"] = {
                "target": yearly_target.target_amount,
                "actual": year_summary.net_profit,
                "rate": round(year_summary.net_profit / yearly_target.target_amount, 4) if yearly_target.target_amount else 0,
                "remaining": round(yearly_target.target_amount - year_summary.net_profit, 2),
            }

        # 季度目标
        quarter = (today.month - 1) // 3 + 1
        quarter_start_month = (quarter - 1) * 3 + 1
        quarter_start = today.replace(month=quarter_start_month, day=1)
        quarterly_target = self.session.scalar(
            select(ProfitTarget).where(
                ProfitTarget.target_type == "quarterly",
                ProfitTarget.target_year == today.year,
                ProfitTarget.target_quarter == quarter,
                (ProfitTarget.store_id == store_id) if store_id else True,
            )
        )
        if quarterly_target:
            quarter_summary = self._get_period_summary(store_id, quarter_start, today, "quarter")
            result["quarterly"] = {
                "target": quarterly_target.target_amount,
                "actual": quarter_summary.net_profit,
                "rate": round(quarter_summary.net_profit / quarterly_target.target_amount, 4) if quarterly_target.target_amount else 0,
                "remaining": round(quarterly_target.target_amount - quarter_summary.net_profit, 2),
            }

        # 月度目标
        month_start = today.replace(day=1)
        monthly_target = self.session.scalar(
            select(ProfitTarget).where(
                ProfitTarget.target_type == "monthly",
                ProfitTarget.target_year == today.year,
                ProfitTarget.target_month == today.month,
                (ProfitTarget.store_id == store_id) if store_id else True,
            )
        )
        if monthly_target:
            month_summary = self.get_month_summary(store_id)
            result["monthly"] = {
                "target": monthly_target.target_amount,
                "actual": month_summary.net_profit,
                "rate": round(month_summary.net_profit / monthly_target.target_amount, 4) if monthly_target.target_amount else 0,
                "remaining": round(monthly_target.target_amount - month_summary.net_profit, 2),
                "days_left": (month_start.replace(month=month_start.month % 12 + 1, day=1) - today).days,
            }

        return result

    # ---------- 推广数据 ----------
    def get_promotion_breakdown(self, store_id: int = 0, days: int = 30) -> Dict[str, float]:
        """推广渠道分布"""
        end = date.today()
        start = end - timedelta(days=days - 1)

        query = select(DailyRecord.promotion_data).where(
            DailyRecord.record_date >= start,
            DailyRecord.record_date <= end,
        )
        if store_id and store_id > 0:
            query = query.where(DailyRecord.store_id == store_id)

        rows = self.session.execute(query).scalars().all()
        breakdown: Dict[str, float] = {}
        for promo_json in rows:
            if not promo_json:
                continue
            for k, v in promo_json.items():
                breakdown[k] = breakdown.get(k, 0) + float(v)
        return {k: round(v, 2) for k, v in sorted(breakdown.items(), key=lambda x: -x[1])}

    # ---------- 成本结构 ----------
    def get_cost_breakdown(self, store_id: int = 0, days: int = 30) -> Dict[str, float]:
        """成本结构"""
        end = date.today()
        start = end - timedelta(days=days - 1)

        query = select(DailyRecord.cost_data).where(
            DailyRecord.record_date >= start,
            DailyRecord.record_date <= end,
        )
        if store_id and store_id > 0:
            query = query.where(DailyRecord.store_id == store_id)

        rows = self.session.execute(query).scalars().all()
        breakdown: Dict[str, float] = {}
        for cost_json in rows:
            if not cost_json:
                continue
            for k, v in cost_json.items():
                breakdown[k] = breakdown.get(k, 0) + float(v)
        return {k: round(v, 2) for k, v in sorted(breakdown.items(), key=lambda x: -x[1])}

    # ---------- 日报数据 ----------
    def get_daily_records(self, store_id: int = 0, days: int = 30) -> List[DailyRecord]:
        """获取每日记录列表"""
        end = date.today()
        start = end - timedelta(days=days - 1)
        query = select(DailyRecord).where(
            DailyRecord.record_date >= start,
            DailyRecord.record_date <= end,
        )
        if store_id and store_id > 0:
            query = query.where(DailyRecord.store_id == store_id)
        return list(self.session.scalars(query.order_by(DailyRecord.record_date.desc())))

    # ---------- 商店列表 ----------
    def get_stores(self, active_only: bool = True) -> List[Store]:
        query = select(Store)
        if active_only:
            query = query.where(Store.is_active == True)
        return list(self.session.scalars(query).all())
