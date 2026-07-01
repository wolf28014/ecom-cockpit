"""
异常预警系统
"""
from datetime import date, timedelta, datetime
from typing import List, Dict
from dataclasses import dataclass

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database.models import DailyRecord, Alert, Store
from app.config import ALERT_THRESHOLDS
from app.core.analytics import AnalyticsService


@dataclass
class AlertItem:
    type: str
    level: str  # info/warning/critical
    title: str
    content: str
    store_id: int = 0
    store_name: str = ""


class AlertService:
    """异常预警服务"""

    def __init__(self, session: Session):
        self.session = session
        self.analytics = AnalyticsService(session)

    def check_all_alerts(self, store_id: int = 0) -> List[AlertItem]:
        """检查所有预警规则"""
        alerts = []
        stores = []
        if store_id:
            store = self.session.get(Store, store_id)
            if store:
                stores = [store]
        else:
            stores = self.analytics.get_stores(active_only=False)

        for store in stores:
            alerts.extend(self._check_store_alerts(store))

        # 全局预警（不区分店铺）
        alerts.extend(self._check_global_alerts())

        # 保存到数据库
        self._save_alerts(alerts)
        return alerts

    def _check_store_alerts(self, store: Store) -> List[AlertItem]:
        alerts = []
        sid = store.id

        # 1. 销售连续下降
        recent = self.session.scalars(
            select(DailyRecord).where(
                DailyRecord.store_id == sid
            ).order_by(DailyRecord.record_date.desc()).limit(ALERT_THRESHOLDS["sales_decline_days"] + 1)
        ).all()
        if len(recent) >= ALERT_THRESHOLDS["sales_decline_days"]:
            decline_days = 0
            for i in range(len(recent) - 1):
                if recent[i].sales_amount < recent[i + 1].sales_amount:
                    decline_days += 1
                else:
                    break
            if decline_days >= ALERT_THRESHOLDS["sales_decline_days"]:
                alerts.append(AlertItem(
                    type="sales_decline",
                    level="warning",
                    title=f"【{store.name}】销售连续 {decline_days} 天下降",
                    content=f"销售额从 ¥{recent[-1].sales_amount:,.2f} 下降至 ¥{recent[0].sales_amount:,.2f}，下降幅度 {((recent[-1].sales_amount - recent[0].sales_amount) / max(recent[-1].sales_amount, 1) * 100):.1f}%。",
                    store_id=sid,
                    store_name=store.name,
                ))

        # 2. 利润异常下降
        today = self.analytics.get_today_summary(sid)
        yesterday = self.analytics.get_custom_summary(sid, date.today() - timedelta(days=1), date.today() - timedelta(days=1))
        if yesterday.net_profit > 0:
            decline = (yesterday.net_profit - today.net_profit) / yesterday.net_profit
            if decline > ALERT_THRESHOLDS["profit_decline_pct"]:
                alerts.append(AlertItem(
                    type="profit_decline",
                    level="critical" if decline > 0.3 else "warning",
                    title=f"【{store.name}】利润环比下降 {decline*100:.1f}%",
                    content=f"昨日净利润 ¥{yesterday.net_profit:,.2f}，今日净利润 ¥{today.net_profit:,.2f}，下降 {decline*100:.1f}%。",
                    store_id=sid,
                    store_name=store.name,
                ))

        # 3. 推广 ROI 异常
        if today.roi > 0 and today.roi < ALERT_THRESHOLDS["promotion_roi_min"]:
            alerts.append(AlertItem(
                type="promotion_roi_low",
                level="critical",
                title=f"【{store.name}】今日推广 ROI 偏低 ({today.roi:.2f})",
                content=f"今日推广 ROI 仅 {today.roi:.2f}，低于阈值 {ALERT_THRESHOLDS['promotion_roi_min']}，建议立即优化推广策略。",
                store_id=sid,
                store_name=store.name,
            ))

        # 4. 退款率过高
        if today.refund_rate > ALERT_THRESHOLDS["refund_rate_max"]:
            alerts.append(AlertItem(
                type="refund_rate_high",
                level="warning",
                title=f"【{store.name}】今日退款率 {today.refund_rate*100:.1f}%",
                content=f"今日退款率 {today.refund_rate*100:.1f}%，超过阈值 {ALERT_THRESHOLDS['refund_rate_max']*100:.0f}%，请关注产品质量和售后服务。",
                store_id=sid,
                store_name=store.name,
            ))

        # 5. 推广费率过高
        if today.promotion_rate > ALERT_THRESHOLDS["promotion_rate_max"]:
            alerts.append(AlertItem(
                type="promotion_rate_high",
                level="warning",
                title=f"【{store.name}】今日推广费率 {today.promotion_rate*100:.1f}%",
                content=f"今日推广费率 {today.promotion_rate*100:.1f}%，超过阈值 {ALERT_THRESHOLDS['promotion_rate_max']*100:.0f}%，建议优化推广结构。",
                store_id=sid,
                store_name=store.name,
            ))

        # 6. 成本异常增加
        if today.cost_total > 0 and yesterday.cost_total > 0:
            cost_change = (today.cost_total - yesterday.cost_total) / yesterday.cost_total
            if cost_change > ALERT_THRESHOLDS["cost_increase_pct"]:
                alerts.append(AlertItem(
                    type="cost_increase",
                    level="warning",
                    title=f"【{store.name}】成本环比上升 {cost_change*100:.1f}%",
                    content=f"昨日成本 ¥{yesterday.cost_total:,.2f}，今日成本 ¥{today.cost_total:,.2f}，上升 {cost_change*100:.1f}%。",
                    store_id=sid,
                    store_name=store.name,
                ))

        return alerts

    def _check_global_alerts(self) -> List[AlertItem]:
        """全局预警（现金流、库存等）"""
        alerts = []

        # 现金流预警（简化版：检查近 30 天净利润趋势）
        trend = self.analytics.get_trend(0, 30)
        if len(trend) >= 7:
            recent_7 = trend[-7:]
            avg_profit = sum(p.profit for p in recent_7) / 7
            if avg_profit < 0:
                alerts.append(AlertItem(
                    type="cashflow_risk",
                    level="critical",
                    title="现金流风险预警",
                    content=f"近 7 天平均净利润为负（¥{avg_profit:,.2f}），存在现金流风险，建议立即审查成本结构。",
                    store_id=0,
                    store_name="全店铺",
                ))

        return alerts

    def _save_alerts(self, alerts: List[AlertItem]):
        """保存预警到数据库（去重）"""
        today = datetime.now()
        for a in alerts:
            # 检查今日是否已有相同预警
            existing = self.session.scalar(
                select(Alert).where(
                    Alert.alert_type == a.type,
                    Alert.store_id == a.store_id,
                    Alert.triggered_at >= today.replace(hour=0, minute=0, second=0),
                )
            )
            if existing:
                continue
            alert = Alert(
                store_id=a.store_id,
                alert_type=a.type,
                level=a.level,
                title=a.title,
                content=a.content,
            )
            self.session.add(alert)
        self.session.commit()

    def get_alerts(self, store_id: int = 0, unread_only: bool = False,
                   limit: int = 50) -> List[Alert]:
        query = select(Alert)
        if store_id:
            query = query.where((Alert.store_id == store_id) | (Alert.store_id == 0))
        if unread_only:
            query = query.where(Alert.is_read == False)
        return list(self.session.scalars(
            query.order_by(Alert.triggered_at.desc()).limit(limit)
        ).all())

    def mark_read(self, alert_id: int):
        alert = self.session.get(Alert, alert_id)
        if alert:
            alert.is_read = True
            self.session.commit()

    def mark_all_read(self, store_id: int = 0):
        query = select(Alert).where(Alert.is_read == False)
        if store_id:
            query = query.where((Alert.store_id == store_id) | (Alert.store_id == 0))
        alerts = self.session.scalars(query).all()
        for a in alerts:
            a.is_read = True
        self.session.commit()
