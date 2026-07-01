"""
AI 服务 - GLM-4 集成
=====================
通过 z-ai CLI 调用真实 GLM-4 API
"""
import json
import subprocess
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import ZAI_CLI_PATH, AI_TIMEOUT, DEFAULT_AI_MODEL
from app.database.models import (
    Store, DailyRecord, AIReport, ChatHistory, ProfitTarget
)
from app.core.analytics import AnalyticsService


# ============== 系统提示词 ==============
SYSTEM_PROMPT_BOSS = """你是电商经营驾驶舱 Pro 的 AI 老板助手，专为中国淘宝/天猫/抖店/拼多多商家设计。

你的职责：
1. 基于真实经营数据回答老板的经营问题
2. 用大白话解释数据背后的原因
3. 给出可执行的经营建议，避免空话套话
4. 涉及金额时用人民币（¥），保留 2 位小数
5. 回答简洁直接，老板时间宝贵

数据背景：{context}

请始终基于上述数据回答，不要编造数据。如果数据不足，请明确告知。"""


SYSTEM_PROMPT_REPORT = """你是电商经营驾驶舱 Pro 的 AI 经营分析师，擅长将枯燥的经营数据转化为有洞察力的经营报告。

报告要求：
1. 用 Markdown 格式输出
2. 包含：核心数据回顾 → 趋势分析 → 异常诊断 → 行动建议 四部分
3. 数据要具体到数字，不要笼统说"有所提升"
4. 建议要可执行，分优先级（立即/本周/本月）
5. 语气专业但不晦涩，老板看得懂
6. 涉及金额用人民币（¥），保留 2 位小数"""


# ============== AI 服务 ==============
class AIService:
    """GLM-4 AI 服务"""

    def __init__(self, session: Session):
        self.session = session
        self.analytics = AnalyticsService(session)

    # ---------- 底层调用 ----------
    def chat(self, system_prompt: str, user_prompt: str,
             model: str = None, timeout: int = None) -> str:
        """调用 GLM-4 完成对话"""
        model = model or DEFAULT_AI_MODEL
        timeout = timeout or AI_TIMEOUT

        # 使用临时文件传递 prompt（避免命令行参数过长）
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.json', delete=False, encoding='utf-8'
        ) as f:
            output_path = f.name

        try:
            cmd = [
                ZAI_CLI_PATH, "chat",
                "-p", user_prompt,
                "-s", system_prompt,
                "-o", output_path,
            ]
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=timeout, encoding='utf-8'
            )
            if result.returncode != 0:
                return f"[AI 调用失败] {result.stderr[:500]}"

            # 读取输出文件
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            return data.get("choices", [{}])[0].get("message", {}).get("content", "")

        except subprocess.TimeoutExpired:
            return "[AI 调用超时] 请检查网络或稍后重试"
        except Exception as e:
            return f"[AI 调用异常] {str(e)}"
        finally:
            try:
                os.unlink(output_path)
            except Exception:
                pass

    # ---------- 经营报告 ----------
    def generate_daily_report(self, store_id: int = 0) -> AIReport:
        """生成 AI 经营日报"""
        today = date.today()
        yesterday = today - timedelta(days=1)

        # 收集数据
        today_summary = self.analytics.get_today_summary(store_id)
        yesterday_summary = self.analytics.get_custom_summary(store_id, yesterday, yesterday)
        trend_7d = self.analytics.get_trend(store_id, 7)
        promotion = self.analytics.get_promotion_breakdown(store_id, 7)

        # 构造 Prompt
        context = self._build_data_context(store_id, days=7)
        user_prompt = f"""请基于以下数据生成【今日经营日报】。

今日数据（{today.isoformat()}）：
- 销售额：¥{today_summary.sales_amount:,.2f}
- 净利润：¥{today_summary.net_profit:,.2f}
- 订单数：{today_summary.order_count}
- 客单价：¥{today_summary.avg_order_value:.2f}
- 利润率：{today_summary.profit_rate*100:.1f}%
- ROI：{today_summary.roi:.2f}
- 推广费率：{today_summary.promotion_rate*100:.1f}%
- 退款率：{today_summary.refund_rate*100:.1f}%

昨日对比：
- 销售额：¥{yesterday_summary.sales_amount:,.2f}
- 净利润：¥{yesterday_summary.net_profit:,.2f}

近 7 天趋势：
{self._format_trend(trend_7d)}

推广渠道分布（近 7 天）：
{self._format_promotion(promotion)}

请按 Markdown 格式输出日报，包含：核心数据、环比变化、异常诊断、行动建议。"""

        content = self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

        # 保存到数据库
        report = AIReport(
            store_id=store_id or 0,
            report_type="daily",
            period_start=today,
            period_end=today,
            title=f"AI 经营日报 - {today.isoformat()}",
            content=content,
            summary=self._extract_summary(content),
            model=DEFAULT_AI_MODEL,
        )
        self.session.add(report)
        self.session.commit()
        return report

    def generate_weekly_report(self, store_id: int = 0) -> AIReport:
        """生成 AI 经营周报"""
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)

        week_summary = self.analytics.get_week_summary(store_id)
        last_week_start = monday - timedelta(days=7)
        last_week_end = sunday - timedelta(days=7)
        last_week_summary = self.analytics.get_custom_summary(store_id, last_week_start, last_week_end)
        trend = self.analytics.get_trend(store_id, 14)
        sku_stats = self.analytics.get_sku_stats(store_id, 7)

        user_prompt = f"""请基于以下数据生成【本周经营周报】。

本周数据（{monday.isoformat()} 至 {today.isoformat()}）：
- 销售额：¥{week_summary.sales_amount:,.2f}
- 净利润：¥{week_summary.net_profit:,.2f}
- 订单数：{week_summary.order_count}
- 利润率：{week_summary.profit_rate*100:.1f}%
- ROI：{week_summary.roi:.2f}
- 推广费率：{week_summary.promotion_rate*100:.1f}%
- 退款率：{week_summary.refund_rate*100:.1f}%

上周对比（{last_week_start.isoformat()} 至 {last_week_end.isoformat()}）：
- 销售额：¥{last_week_summary.sales_amount:,.2f}
- 净利润：¥{last_week_summary.net_profit:,.2f}

近 14 天趋势：
{self._format_trend(trend)}

本周 SKU 表现 TOP 5：
{self._format_sku_top(sku_stats[:5])}

请按 Markdown 格式输出周报，包含：本周总结、环比分析、爆款表现、推广效果、问题诊断、下阶段建议。"""

        content = self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

        report = AIReport(
            store_id=store_id or 0,
            report_type="weekly",
            period_start=monday,
            period_end=today,
            title=f"AI 经营周报 - {monday.isoformat()} 至 {today.isoformat()}",
            content=content,
            summary=self._extract_summary(content),
            model=DEFAULT_AI_MODEL,
        )
        self.session.add(report)
        self.session.commit()
        return report

    def generate_monthly_report(self, store_id: int = 0) -> AIReport:
        """生成 AI 经营月报"""
        today = date.today()
        month_start = today.replace(day=1)

        month_summary = self.analytics.get_month_summary(store_id)
        trend = self.analytics.get_trend(store_id, 30)
        sku_stats = self.analytics.get_sku_stats(store_id, 30)
        promotion = self.analytics.get_promotion_breakdown(store_id, 30)
        cost = self.analytics.get_cost_breakdown(store_id, 30)

        # 上月数据
        if today.month == 1:
            last_month_start = today.replace(year=today.year - 1, month=12, day=1)
            last_month_end = last_month_start.replace(day=28)
        else:
            last_month_start = today.replace(month=today.month - 1, day=1)
            next_month = today.replace(day=28) + timedelta(days=4)
            last_month_end = next_month - timedelta(days=next_month.day)
        last_month_summary = self.analytics.get_custom_summary(store_id, last_month_start, last_month_end)

        user_prompt = f"""请基于以下数据生成【本月经营月报】。

本月数据（{month_start.isoformat()} 至 {today.isoformat()}）：
- 销售额：¥{month_summary.sales_amount:,.2f}
- 净利润：¥{month_summary.net_profit:,.2f}
- 订单数：{month_summary.order_count}
- 利润率：{month_summary.profit_rate*100:.1f}%
- ROI：{month_summary.roi:.2f}
- 推广费率：{month_summary.promotion_rate*100:.1f}%
- 退款率：{month_summary.refund_rate*100:.1f}%
- 客单价：¥{month_summary.avg_order_value:.2f}

上月对比：
- 销售额：¥{last_month_summary.sales_amount:,.2f}
- 净利润：¥{last_month_summary.net_profit:,.2f}

近 30 天趋势：
{self._format_trend(trend)}

本月 TOP 5 SKU：
{self._format_sku_top(sku_stats[:5])}

推广渠道分布：
{self._format_promotion(promotion)}

成本结构：
{self._format_cost(cost)}

请按 Markdown 格式输出月报，包含：月度总结、同比环比、爆款分析、推广效果、成本诊断、问题清单、下月建议。"""

        content = self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

        report = AIReport(
            store_id=store_id or 0,
            report_type="monthly",
            period_start=month_start,
            period_end=today,
            title=f"AI 经营月报 - {today.year}年{today.month}月",
            content=content,
            summary=self._extract_summary(content),
            model=DEFAULT_AI_MODEL,
        )
        self.session.add(report)
        self.session.commit()
        return report

    def generate_yearly_report(self, store_id: int = 0) -> AIReport:
        """生成 AI 经营年报"""
        today = date.today()
        year_start = today.replace(month=1, day=1)

        year_summary = self.analytics.get_year_summary(store_id)
        trend = self.analytics.get_trend(store_id, min(365, 180))
        sku_stats = self.analytics.get_sku_stats(store_id, 90)

        user_prompt = f"""请基于以下数据生成【本年度经营年报】。

本年数据（{year_start.isoformat()} 至 {today.isoformat()}）：
- 销售额：¥{year_summary.sales_amount:,.2f}
- 净利润：¥{year_summary.net_profit:,.2f}
- 订单数：{year_summary.order_count}
- 利润率：{year_summary.profit_rate*100:.1f}%
- ROI：{year_summary.roi:.2f}
- 客单价：¥{year_summary.avg_order_value:.2f}

近 180 天趋势：
{self._format_trend(trend)}

年度 TOP 5 SKU：
{self._format_sku_top(sku_stats[:5])}

请按 Markdown 格式输出年报，包含：年度总结、增长分析、爆款回顾、问题诊断、下年战略建议。"""

        content = self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

        report = AIReport(
            store_id=store_id or 0,
            report_type="yearly",
            period_start=year_start,
            period_end=today,
            title=f"AI 经营年报 - {today.year}",
            content=content,
            summary=self._extract_summary(content),
            model=DEFAULT_AI_MODEL,
        )
        self.session.add(report)
        self.session.commit()
        return report

    def generate_suggestions(self, store_id: int = 0) -> AIReport:
        """生成 AI 经营建议（销售/推广/定价/库存/风险）"""
        today_summary = self.analytics.get_today_summary(store_id)
        week_summary = self.analytics.get_week_summary(store_id)
        sku_stats = self.analytics.get_sku_stats(store_id, 7)
        promotion = self.analytics.get_promotion_breakdown(store_id, 7)
        target_progress = self.analytics.get_profit_target_progress(store_id)

        user_prompt = f"""请基于以下数据生成【今日经营建议】，覆盖 5 个维度：销售建议、推广建议、定价建议、库存建议、风险提醒。

今日核心数据：
- 销售额：¥{today_summary.sales_amount:,.2f}
- 净利润：¥{today_summary.net_profit:,.2f}
- 利润率：{today_summary.profit_rate*100:.1f}%
- ROI：{today_summary.roi:.2f}
- 推广费率：{today_summary.promotion_rate*100:.1f}%

本周数据：
- 销售额：¥{week_summary.sales_amount:,.2f}
- 净利润：¥{week_summary.net_profit:,.2f}

利润目标进度：
{self._format_target(target_progress)}

近 7 天 TOP SKU：
{self._format_sku_top(sku_stats[:5])}

推广渠道分布：
{self._format_promotion(promotion)}

请用 Markdown 输出，每个维度 2-3 条具体建议，附数据依据。"""

        content = self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

        report = AIReport(
            store_id=store_id or 0,
            report_type="suggestion",
            period_start=today_summary.period and date.today() or date.today(),
            period_end=date.today(),
            title=f"AI 经营建议 - {date.today().isoformat()}",
            content=content,
            summary=self._extract_summary(content),
            model=DEFAULT_AI_MODEL,
        )
        self.session.add(report)
        self.session.commit()
        return report

    # ---------- 老板助手聊天 ----------
    def boss_chat(self, store_id: int, question: str) -> str:
        """老板助手对话"""
        context = self._build_data_context(store_id, days=30)
        system_prompt = SYSTEM_PROMPT_BOSS.format(context=context)

        # 保存用户消息
        self.session.add(ChatHistory(
            store_id=store_id,
            role="user",
            content=question,
        ))

        answer = self.chat(system_prompt, question)

        # 保存助手回复
        self.session.add(ChatHistory(
            store_id=store_id,
            role="assistant",
            content=answer,
        ))
        self.session.commit()
        return answer

    def get_chat_history(self, store_id: int, limit: int = 20) -> List[ChatHistory]:
        return list(self.session.scalars(
            select(ChatHistory).where(ChatHistory.store_id == store_id)
            .order_by(ChatHistory.created_at.desc()).limit(limit)
        ).all())[::-1]

    # ---------- AI 现金流预测 ----------
    def predict_cashflow(self, store_id: int, days: int = 30) -> str:
        """AI 现金流预测"""
        trend = self.analytics.get_trend(store_id, 30)
        avg_daily_sales = sum(p.sales for p in trend) / len(trend) if trend else 0
        avg_daily_profit = sum(p.profit for p in trend) / len(trend) if trend else 0
        avg_daily_cost = sum(p.cost for p in trend) / len(trend) if trend else 0

        user_prompt = f"""请基于以下数据预测未来 {days} 天的现金流。

近 30 天日均数据：
- 日均销售额：¥{avg_daily_sales:,.2f}
- 日均净利润：¥{avg_daily_profit:,.2f}
- 日均成本：¥{avg_daily_cost:,.2f}

预测未来 {days} 天，并给出建议。请用 Markdown 输出，包含：收入预测、利润预测、支出预测、现金余额预测、风险提醒、优化建议。"""

        return self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

    # ---------- AI 经营模拟 ----------
    def simulate_scenario(self, store_id: int, scenario: str) -> str:
        """AI 经营模拟（如：如果推广增加 20%）"""
        today = self.analytics.get_today_summary(store_id)
        week = self.analytics.get_week_summary(store_id)

        user_prompt = f"""请基于当前经营数据进行情景模拟分析。

情景假设：{scenario}

当前数据：
- 今日销售额：¥{today.sales_amount:,.2f}
- 今日净利润：¥{today.net_profit:,.2f}
- 今日推广费：¥{today.promotion_total:,.2f}
- 今日 ROI：{today.roi:.2f}
- 本周销售额：¥{week.sales_amount:,.2f}
- 本周净利润：¥{week.net_profit:,.2f}

请用 Markdown 输出模拟结果：预计销售变化、预计利润变化、关键假设、风险提示、是否建议执行。"""

        return self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

    # ---------- AI 利润目标预测 ----------
    def predict_profit_target(self, store_id: int) -> str:
        """AI 利润目标预测"""
        progress = self.analytics.get_profit_target_progress(store_id)
        today = date.today()
        year_summary = self.analytics.get_year_summary(store_id)
        days_passed = (today - today.replace(month=1, day=1)).days + 1
        days_total = 365 + (1 if today.year % 4 == 0 else 0)
        daily_avg_profit = year_summary.net_profit / days_passed if days_passed else 0
        projected_year_profit = daily_avg_profit * days_total

        user_prompt = f"""请基于当前进度预测年度利润目标完成情况。

当前数据：
- 已经过去：{days_passed} 天
- 全年天数：{days_total} 天
- 已完成净利润：¥{year_summary.net_profit:,.2f}
- 日均净利润：¥{daily_avg_profit:,.2f}
- 按当前节奏预计全年利润：¥{projected_year_profit:,.2f}

利润目标进度：
{self._format_target(progress)}

请用 Markdown 输出：完成概率评估、缺口分析、达成路径建议、关键举措优先级。"""

        return self.chat(SYSTEM_PROMPT_REPORT, user_prompt)

    # ---------- 历史报告 ----------
    def get_reports(self, store_id: int = 0, report_type: str = None, limit: int = 20) -> List[AIReport]:
        query = select(AIReport).where(AIReport.store_id == store_id or 0 == 0)
        if store_id:
            query = query.where((AIReport.store_id == store_id) | (AIReport.store_id == 0))
        if report_type:
            query = query.where(AIReport.report_type == report_type)
        return list(self.session.scalars(
            query.order_by(AIReport.created_at.desc()).limit(limit)
        ).all())

    # ============== 内部工具 ==============
    def _build_data_context(self, store_id: int, days: int = 30) -> str:
        """构造数据上下文"""
        from datetime import date, timedelta
        today = date.today()
        yesterday = today - timedelta(days=1)

        today_sum = self.analytics.get_today_summary(store_id)
        yesterday_sum = self.analytics.get_custom_summary(store_id, yesterday, yesterday)
        week_sum = self.analytics.get_week_summary(store_id)
        month_sum = self.analytics.get_month_summary(store_id)
        year_sum = self.analytics.get_year_summary(store_id)
        progress = self.analytics.get_profit_target_progress(store_id)

        store_name = "全店铺汇总"
        if store_id:
            store = self.session.get(Store, store_id)
            if store:
                store_name = store.name

        # 计算环比
        sales_change_pct = ((today_sum.sales_amount - yesterday_sum.sales_amount) / yesterday_sum.sales_amount * 100) if yesterday_sum.sales_amount else 0
        profit_change_pct = ((today_sum.net_profit - yesterday_sum.net_profit) / abs(yesterday_sum.net_profit) * 100) if yesterday_sum.net_profit else 0

        return f"""当前店铺：{store_name}
今日（{today.isoformat()}）：销售额¥{today_sum.sales_amount:,.2f}、净利润¥{today_sum.net_profit:,.2f}、订单{today_sum.order_count}单、利润率{today_sum.profit_rate*100:.1f}%、ROI {today_sum.roi:.2f}、推广费率{today_sum.promotion_rate*100:.1f}%、退款率{today_sum.refund_rate*100:.1f}%
昨日（{yesterday.isoformat()}）：销售额¥{yesterday_sum.sales_amount:,.2f}、净利润¥{yesterday_sum.net_profit:,.2f}、订单{yesterday_sum.order_count}单
环比变化：销售额 {sales_change_pct:+.1f}%、净利润 {profit_change_pct:+.1f}%
本周：销售额¥{week_sum.sales_amount:,.2f}、净利润¥{week_sum.net_profit:,.2f}
本月：销售额¥{month_sum.sales_amount:,.2f}、净利润¥{month_sum.net_profit:,.2f}、利润率{month_sum.profit_rate*100:.1f}%
本年：销售额¥{year_sum.sales_amount:,.2f}、净利润¥{year_sum.net_profit:,.2f}
利润目标进度：{self._format_target(progress)}"""

    def _format_trend(self, trend) -> str:
        if not trend:
            return "无趋势数据"
        lines = []
        for p in trend[-7:]:  # 只取最近 7 天
            lines.append(f"  - {p.date}: 销售¥{p.sales:,.0f}、利润¥{p.profit:,.0f}、订单{p.orders}")
        return "\n".join(lines)

    def _format_sku_top(self, skus) -> str:
        if not skus:
            return "无 SKU 数据"
        lines = []
        for s in skus:
            lines.append(f"  - {s.sku_name}（{s.sku_code}）：销售¥{s.sales_amount:,.0f}、利润¥{s.gross_profit:,.0f}、ROI {s.roi:.2f}、销量{s.quantity}件")
        return "\n".join(lines)

    def _format_promotion(self, promo: Dict[str, float]) -> str:
        if not promo:
            return "无推广数据"
        lines = []
        for k, v in promo.items():
            lines.append(f"  - {k}: ¥{v:,.2f}")
        return "\n".join(lines)

    def _format_cost(self, cost: Dict[str, float]) -> str:
        if not cost:
            return "无成本数据"
        lines = []
        for k, v in cost.items():
            lines.append(f"  - {k}: ¥{v:,.2f}")
        return "\n".join(lines)

    def _format_target(self, progress: Dict) -> str:
        if not progress:
            return "暂未设置利润目标"
        lines = []
        for k, v in progress.items():
            target = v.get("target", 0)
            actual = v.get("actual", 0)
            rate = v.get("rate", 0) * 100
            lines.append(f"  - {k}: 目标¥{target:,.0f}、已完成¥{actual:,.0f}、完成率{rate:.1f}%")
        return "\n".join(lines)

    def _extract_summary(self, content: str, max_len: int = 150) -> str:
        """从 Markdown 报告中提取摘要"""
        if not content:
            return ""
        # 找第一段非标题文本
        lines = content.split("\n")
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("-"):
                return stripped[:max_len]
        return content[:max_len]
