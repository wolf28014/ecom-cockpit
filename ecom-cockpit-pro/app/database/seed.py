"""
演示数据生成器
=================
首次启动时自动写入：
- 1 个淘宝演示店铺 + 1 个天猫店 + 1 个抖店
- 12 个 SKU
- 90 天每日经营数据（含推广/成本/SKU 销售）
- 年度/季度/月度利润目标
- 历史预警记录
"""
import random
from datetime import date, timedelta, datetime
from typing import List

from sqlalchemy.orm import Session

from app.database.models import (
    Store, SKU, DailyRecord, DailySKU,
    ProfitTarget, Alert, Setting
)
from app.config import PLATFORM_PROMOTION_FIELDS


# 固定随机种子，保证每次生成数据一致
random.seed(42)


# ============== 演示店铺 ==============
DEMO_STORES = [
    {
        "name": "潮流数码旗舰店",
        "platform": "taobao",
        "shop_url": "https://shop12345.taobao.com",
        "contact": "张老板",
        "note": "主营数码配件、智能家居"
    },
    {
        "name": "美妆精选天猫店",
        "platform": "tmall",
        "shop_url": "https://meizhuang.tmall.com",
        "contact": "李老板",
        "note": "美妆个护品类"
    },
    {
        "name": "潮流服饰抖店",
        "platform": "douyin",
        "shop_url": "https://douyin.com/shop/fushi",
        "contact": "王老板",
        "note": "女装直播带货"
    },
]


# ============== 演示 SKU ==============
DEMO_SKUS = [
    {"sku_code": "SP-001", "sku_name": "无线蓝牙耳机 Pro", "category": "数码", "unit_cost": 65, "unit_price": 199},
    {"sku_code": "SP-002", "sku_name": "便携充电宝 20000mAh", "category": "数码", "unit_cost": 45, "unit_price": 129},
    {"sku_code": "SP-003", "sku_name": "智能手表运动版", "category": "数码", "unit_cost": 120, "unit_price": 359},
    {"sku_code": "SP-004", "sku_name": "Type-C 数据线 3米", "category": "数码", "unit_cost": 5, "unit_price": 29},
    {"sku_code": "SP-005", "sku_name": "便携蓝牙音箱", "category": "数码", "unit_cost": 80, "unit_price": 219},
    {"sku_code": "SP-006", "sku_name": "手机支架铝合金", "category": "数码", "unit_cost": 12, "unit_price": 49},
    {"sku_code": "SP-007", "sku_name": "智能台灯护眼", "category": "智能家居", "unit_cost": 55, "unit_price": 159},
    {"sku_code": "SP-008", "sku_name": "加湿器 4L 大容量", "category": "智能家居", "unit_cost": 38, "unit_price": 109},
    {"sku_code": "SP-009", "sku_name": "电动牙刷声波", "category": "个护", "unit_cost": 28, "unit_price": 99},
    {"sku_code": "SP-010", "sku_name": "车载空气净化器", "category": "智能家居", "unit_cost": 75, "unit_price": 229},
    {"sku_code": "SP-011", "sku_name": "USB 拓展坞 7合1", "category": "数码", "unit_cost": 35, "unit_price": 99},
    {"sku_code": "SP-012", "sku_name": "无线鼠标静音", "category": "数码", "unit_cost": 18, "unit_price": 59},
]


def seed_demo_data_if_empty(session: Session):
    """如果数据库为空，写入演示数据"""
    if session.query(Store).count() > 0:
        return  # 已有数据，跳过

    # 1. 创建店铺
    stores = []
    for store_data in DEMO_STORES:
        store = Store(**store_data, is_active=True)
        session.add(store)
        stores.append(store)
    session.flush()

    # 2. 为每个店铺创建 SKU（同样的 12 个 SKU）
    for store in stores:
        for sku_data in DEMO_SKUS:
            sku = SKU(
                store_id=store.id,
                stock=random.randint(50, 500),
                **sku_data
            )
            session.add(sku)
    session.flush()

    # 3. 生成 90 天历史数据
    today = date.today()
    start_date = today - timedelta(days=89)

    for store in stores:
        # 加载该店铺所有 SKU
        skus = session.query(SKU).filter(SKU.store_id == store.id).all()
        if not skus:
            continue

        platform_fields = PLATFORM_PROMOTION_FIELDS.get(store.platform, ["其他"])
        # 平台系数（不同店铺规模不同）
        scale = 1.0 if store.platform == "taobao" else (0.7 if store.platform == "tmall" else 0.5)

        # 90 天循环生成
        for i in range(90):
            record_date = start_date + timedelta(days=i)

            # 周末销售通常更高
            weekday = record_date.weekday()
            weekend_boost = 1.3 if weekday >= 5 else 1.0

            # 月末促销峰
            month_end_boost = 1.4 if record_date.day >= 28 else 1.0

            # 整体增长趋势（每月递增 5%）
            month_idx = i // 30
            trend_boost = 1.0 + month_idx * 0.05

            # 随机波动 ±15%
            noise = random.uniform(0.85, 1.15)

            # 基础销售额
            base_sales = 8000 * scale * weekend_boost * month_end_boost * trend_boost * noise
            sales_amount = round(base_sales, 2)

            # 订单数（基于客单价反推）
            avg_price = 130
            order_count = max(1, int(sales_amount / avg_price))

            # 退款（5%-10% 退款率）
            refund_rate = random.uniform(0.03, 0.09)
            refund_amount = round(sales_amount * refund_rate, 2)
            refund_order_count = int(order_count * refund_rate)

            # 推广数据（占销售额 15%-25%）
            promo_total_rate = random.uniform(0.15, 0.25)
            promo_total = round(sales_amount * promo_total_rate, 2)
            promo_data = _split_promotion(promo_total, platform_fields)

            # 成本数据
            goods_cost_rate = 0.45  # 商品成本占 45%
            goods_cost = round(sales_amount * goods_cost_rate, 2)
            shipping_cost = round(order_count * random.uniform(3, 5), 2)
            package_cost = round(order_count * random.uniform(0.8, 1.5), 2)
            labor_cost = round(300 * scale, 2)  # 人工日固定
            rent_cost = round(200 * scale, 2)   # 房租日固定
            other_cost = round(sales_amount * 0.02, 2)

            cost_data = {
                "商品成本": goods_cost,
                "运费": shipping_cost,
                "包装": package_cost,
                "人工": labor_cost,
                "房租": rent_cost,
                "其他": other_cost,
            }
            cost_total = round(goods_cost + shipping_cost + package_cost + labor_cost + rent_cost + other_cost, 2)

            # 自动计算
            gross_profit = round(sales_amount - goods_cost - refund_amount, 2)
            net_profit = round(gross_profit - promo_total - shipping_cost - package_cost - labor_cost - rent_cost - other_cost, 2)
            profit_rate = round(net_profit / sales_amount, 4) if sales_amount else 0
            roi = round(sales_amount / promo_total, 2) if promo_total else 0
            avg_order_value = round(sales_amount / order_count, 2) if order_count else 0
            profit_per_order = round(net_profit / order_count, 2) if order_count else 0

            record = DailyRecord(
                store_id=store.id,
                record_date=record_date,
                sales_amount=sales_amount,
                order_count=order_count,
                refund_amount=refund_amount,
                refund_order_count=refund_order_count,
                promotion_data=promo_data,
                promotion_total=promo_total,
                cost_data=cost_data,
                cost_total=cost_total,
                gross_profit=gross_profit,
                net_profit=net_profit,
                profit_rate=profit_rate,
                roi=roi,
                avg_order_value=avg_order_value,
                profit_per_order=profit_per_order,
                refund_rate=round(refund_rate, 4),
                promotion_rate=round(promo_total_rate, 4),
            )
            session.add(record)
            session.flush()

            # 为该日生成 SKU 销售数据（销量集中在 3-5 个 SKU 上）
            active_sku_count = random.randint(4, 6)
            active_skus = random.sample(skus, min(active_sku_count, len(skus)))

            # 分配销售额（80% 集中在前 2 个 SKU）
            weights = [0.4, 0.3] + [0.3 / (len(active_skus) - 2)] * (len(active_skus) - 2) if len(active_skus) > 2 else [0.5, 0.5]
            for sku, weight in zip(active_skus, weights):
                sku_sales = round(sales_amount * weight * random.uniform(0.9, 1.1), 2)
                sku_orders = max(1, int(order_count * weight))
                sku_qty = max(1, int(sku_orders * random.uniform(1.0, 1.5)))
                sku_cost = round(sku.unit_cost * sku_qty, 2)
                sku_refund = round(sku_sales * refund_rate, 2)
                sku_gross = round(sku_sales - sku_cost - sku_refund, 2)

                daily_sku = DailySKU(
                    daily_record_id=record.id,
                    sku_id=sku.id,
                    record_date=record_date,
                    store_id=store.id,
                    sales_amount=sku_sales,
                    order_count=sku_orders,
                    refund_amount=sku_refund,
                    refund_order_count=int(sku_orders * refund_rate),
                    quantity=sku_qty,
                    cost=sku_cost,
                    gross_profit=sku_gross,
                    roi=round(sku_sales / max(sku_cost, 0.01), 2),
                    refund_rate=round(refund_rate, 4),
                )
                session.add(daily_sku)

    # 4. 利润目标（淘宝主店）
    main_store = stores[0]
    today = date.today()
    targets = [
        ProfitTarget(store_id=main_store.id, target_type="yearly",
                     target_year=today.year, target_amount=3_000_000),
        ProfitTarget(store_id=main_store.id, target_type="quarterly",
                     target_year=today.year, target_quarter=(today.month - 1) // 3 + 1,
                     target_amount=800_000),
        ProfitTarget(store_id=main_store.id, target_type="monthly",
                     target_year=today.year, target_month=today.month, target_amount=280_000),
    ]
    for t in targets:
        session.add(t)

    # 5. 默认设置
    settings = [
        Setting(key="theme", value="light", description="主题"),
        Setting(key="ai_model", value="glm-4-plus", description="AI 模型"),
        Setting(key="auto_backup", value="weekly", description="自动备份频率"),
        Setting(key="currency", value="CNY", description="货币"),
        Setting(key="company_name", value="我的电商公司", description="公司名称"),
    ]
    for s in settings:
        session.add(s)

    # 6. 历史预警（最近 7 天的几条）
    for store in stores[:1]:  # 只为主店生成
        alerts = [
            Alert(store_id=store.id, alert_type="refund_rate_high",
                  level="warning",
                  title="退款率连续 3 天超过阈值",
                  content=f"店铺【{store.name}】退款率连续 3 天超过 8%，请关注产品质量和售后服务。",
                  triggered_at=datetime.now() - timedelta(days=2)),
            Alert(store_id=store.id, alert_type="promotion_roi_low",
                  level="critical",
                  title="直通车 ROI 偏低",
                  content="直通车 ROI 低于 1.5，建议优化关键词和出价策略。",
                  triggered_at=datetime.now() - timedelta(days=1)),
            Alert(store_id=store.id, alert_type="profit_decline",
                  level="warning",
                  title="昨日净利润环比下降 18%",
                  content="昨日净利润环比下降 18%，主要受推广成本上升影响。",
                  triggered_at=datetime.now() - timedelta(hours=12)),
        ]
        for a in alerts:
            session.add(a)

    session.commit()
    print(f"[Seed] 已写入演示数据：3 个店铺、12 个 SKU、90 天经营数据")


def _split_promotion(total: float, fields: List[str]) -> dict:
    """按平台字段拆分推广预算"""
    if not fields:
        return {"其他": total}
    weights = [random.uniform(0.5, 1.5) for _ in fields]
    total_w = sum(weights)
    return {field: round(total * w / total_w, 2) for field, w in zip(fields, weights)}
