import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { db } from "@/lib/db";

// 报表导出（返回 JSON 结构 + 文件下载链接）
// 为了简化 web 版实现，这里返回结构化数据，前端用浏览器打印或第三方库导出
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const format = req.nextUrl.searchParams.get("format") || "json"; // json | excel | pdf | word | ppt
  const period = req.nextUrl.searchParams.get("period") || "month";

  let summary;
  if (period === "today") summary = await AnalyticsService.getTodaySummary(storeId);
  else if (period === "week") summary = await AnalyticsService.getWeekSummary(storeId);
  else if (period === "year") summary = await AnalyticsService.getYearSummary(storeId);
  else summary = await AnalyticsService.getMonthSummary(storeId);

  const trend = await AnalyticsService.getTrend(30, storeId);
  const skuStats = await AnalyticsService.getSkuStats(30, storeId);

  let storeName = "全店铺汇总";
  if (storeId) {
    const store = await db.store.findUnique({ where: { id: storeId } });
    if (store) storeName = store.name;
  }

  const data = {
    storeName,
    period,
    periodLabel: { today: "今日", week: "本周", month: "本月", year: "本年" }[period] || period,
    generatedAt: new Date().toISOString(),
    summary,
    trend,
    skuTop10: skuStats.slice(0, 10),
  };

  if (format === "json") {
    return NextResponse.json(data);
  }

  // Excel: 返回 CSV（浏览器可直接下载，简单实用）
  if (format === "excel") {
    const rows = trend.map(p => ({
      日期: p.date,
      销售额: p.sales,
      订单: p.orders,
      推广: p.promotion,
      成本: p.cost,
      利润: p.profit,
      利润率: `${(p.profitRate * 100).toFixed(1)}%`,
      ROI: p.roi,
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => r[h as keyof typeof r]).join(",")),
    ].join("\n");
    // Add BOM for Excel UTF-8 compatibility
    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${period}-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // 其他格式暂返回 JSON，前端可基于此渲染打印版
  return NextResponse.json(data);
}
