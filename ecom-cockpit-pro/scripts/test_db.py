"""
数据库初始化测试脚本
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.connection import init_db, get_session
from app.database.models import Store, DailyRecord, SKU, ProfitTarget, Alert
from app.database.seed import seed_demo_data_if_empty
from app.config import DB_URL, DB_PATH

print(f"数据库路径: {DB_PATH}")
print(f"数据库 URL: {DB_URL}")

init_db(DB_URL)
print("[OK] 数据库初始化成功")

with get_session() as session:
    seed_demo_data_if_empty(session)
    store_count = session.query(Store).count()
    sku_count = session.query(SKU).count()
    record_count = session.query(DailyRecord).count()
    target_count = session.query(ProfitTarget).count()
    alert_count = session.query(Alert).count()

print(f"店铺数: {store_count}")
print(f"SKU 数: {sku_count}")
print(f"每日记录数: {record_count}")
print(f"利润目标数: {target_count}")
print(f"预警数: {alert_count}")

# 检查最近一天的数据
with get_session() as session:
    latest = session.query(DailyRecord).order_by(DailyRecord.record_date.desc()).first()
    if latest:
        print(f"\n最近一天数据:")
        print(f"  日期: {latest.record_date}")
        print(f"  销售额: ¥{latest.sales_amount:,.2f}")
        print(f"  订单数: {latest.order_count}")
        print(f"  推广费: ¥{latest.promotion_total:,.2f}")
        print(f"  净利润: ¥{latest.net_profit:,.2f}")
        print(f"  利润率: {latest.profit_rate*100:.1f}%")
        print(f"  ROI: {latest.roi:.2f}")
        print(f"  客单价: ¥{latest.avg_order_value:.2f}")
