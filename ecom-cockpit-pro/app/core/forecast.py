"""
现金流预测服务
"""
from datetime import date, timedelta
from typing import List, Dict
from dataclasses import dataclass

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database.models import DailyRecord, CashFlow
from app.core.analytics import AnalyticsService


@dataclass
class CashFlowForecast:
    """现金流预测结果"""
    forecast_days: int
    avg_daily_sales: float
    avg_daily_profit: float
    avg_daily_cost: float
    projected_sales: float
    projected_profit: float
    projected_cost: float
    projected_balance: float
    risk_level: str  # safe/warning/danger
    daily_forecast: List[Dict]  # 每日预测


class ForecastService:
    """现金流预测服务"""

    def __init__(self, session: Session):
        self.session = session
        self.analytics = AnalyticsService(session)

    def forecast(self, store_id: int = 0, days: int = 30) -> CashFlowForecast:
        """预测未来 N 天现金流"""
        # 取最近 30 天作为基准
        trend = self.analytics.get_trend(store_id, 30)
        if not trend:
            return CashFlowForecast(
                forecast_days=days,
                avg_daily_sales=0, avg_daily_profit=0, avg_daily_cost=0,
                projected_sales=0, projected_profit=0, projected_cost=0,
                projected_balance=0, risk_level="safe", daily_forecast=[]
            )

        avg_sales = sum(p.sales for p in trend) / len(trend)
        avg_profit = sum(p.profit for p in trend) / len(trend)
        avg_cost = sum(p.cost for p in trend) / len(trend)

        # 计算当前现金余额（简化：累计净利润）
        year_summary = self.analytics.get_year_summary(store_id)
        current_balance = year_summary.net_profit

        # 生成每日预测（带轻微波动）
        daily_forecast = []
        balance = current_balance
        today = date.today()
        for i in range(1, days + 1):
            forecast_date = today + timedelta(days=i)
            # 周末略增
            weekend_boost = 1.2 if forecast_date.weekday() >= 5 else 1.0

            day_sales = avg_sales * weekend_boost
            day_cost = avg_cost
            day_profit = avg_profit * weekend_boost
            balance += day_profit

            daily_forecast.append({
                "date": forecast_date.isoformat(),
                "sales": round(day_sales, 2),
                "cost": round(day_cost, 2),
                "profit": round(day_profit, 2),
                "balance": round(balance, 2),
            })

        # 风险评估
        min_balance = min(d["balance"] for d in daily_forecast)
        if min_balance < 0:
            risk_level = "danger"
        elif min_balance < avg_cost * 7:
            risk_level = "warning"
        else:
            risk_level = "safe"

        return CashFlowForecast(
            forecast_days=days,
            avg_daily_sales=round(avg_sales, 2),
            avg_daily_profit=round(avg_profit, 2),
            avg_daily_cost=round(avg_cost, 2),
            projected_sales=round(avg_sales * days, 2),
            projected_profit=round(avg_profit * days, 2),
            projected_cost=round(avg_cost * days, 2),
            projected_balance=round(balance, 2),
            risk_level=risk_level,
            daily_forecast=daily_forecast,
        )

    def forecast_7_days(self, store_id: int = 0) -> CashFlowForecast:
        return self.forecast(store_id, 7)

    def forecast_30_days(self, store_id: int = 0) -> CashFlowForecast:
        return self.forecast(store_id, 30)

    def forecast_90_days(self, store_id: int = 0) -> CashFlowForecast:
        return self.forecast(store_id, 90)

    def get_cashflow_history(self, store_id: int = 0, days: int = 30) -> List[CashFlow]:
        end = date.today()
        start = end - timedelta(days=days - 1)
        query = select(CashFlow).where(
            CashFlow.record_date >= start,
            CashFlow.record_date <= end,
        )
        if store_id:
            query = query.where((CashFlow.store_id == store_id) | (CashFlow.store_id == 0))
        return list(self.session.scalars(query.order_by(CashFlow.record_date.desc())).all())
