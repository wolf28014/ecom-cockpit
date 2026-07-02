"""核心服务测试"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.connection import init_db, get_session
from app.core.analytics import AnalyticsService
from app.core.forecast import ForecastService
from app.core.alerts import AlertService
from app.core.exporter import ExportService

init_db()

with get_session() as session:
    print("=" * 50)
    print("【测试】AnalyticsService")
    print("=" * 50)
    svc = AnalyticsService(session)
    today = svc.get_today_summary(1)
    print(f"今日销售额: ¥{today.sales_amount:,.2f}")
    print(f"今日净利润: ¥{today.net_profit:,.2f}")
    print(f"今日利润率: {today.profit_rate*100:.1f}%")

    week = svc.get_week_summary(1)
    print(f"\n本周销售额: ¥{week.sales_amount:,.2f}")
    print(f"本周净利润: ¥{week.net_profit:,.2f}")

    trend = svc.get_trend(1, 7)
    print(f"\n近 7 天趋势:")
    for p in trend[-3:]:
        print(f"  {p.date}: 销售¥{p.sales:,.0f} 利润¥{p.profit:,.0f}")

    print("\n" + "=" * 50)
    print("【测试】AlertService")
    print("=" * 50)
    alert_svc = AlertService(session)
    alerts = alert_svc.check_all_alerts(1)
    print(f"检测到 {len(alerts)} 条预警")
    for a in alerts:
        print(f"  [{a.level}] {a.title}")

    print("\n" + "=" * 50)
    print("【测试】ForecastService")
    print("=" * 50)
    forecast_svc = ForecastService(session)
    forecast = forecast_svc.forecast_30_days(1)
    print(f"未来 30 天预测：")
    print(f"  预计销售: ¥{forecast.projected_sales:,.2f}")
    print(f"  预计利润: ¥{forecast.projected_profit:,.2f}")
    print(f"  风险等级: {forecast.risk_level}")

    print("\n" + "=" * 50)
    print("【测试】ExportService")
    print("=" * 50)
    export_svc = ExportService(session)
    excel_path = export_svc.export_daily_excel(store_id=1, days=30)
    print(f"Excel 导出: {excel_path}")

    pdf_path = export_svc.export_pdf(store_id=1, period="month")
    print(f"PDF 导出: {pdf_path}")

    word_path = export_svc.export_word(store_id=1, period="month")
    print(f"Word 导出: {word_path}")

    ppt_path = export_svc.export_ppt(store_id=1)
    print(f"PPT 导出: {ppt_path}")

print("\n[OK] 所有核心服务测试通过")
