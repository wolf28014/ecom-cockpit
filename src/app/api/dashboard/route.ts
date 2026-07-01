import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";

// 首页驾驶舱 - 综合数据（含自然年/季节年）
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const trendDays = parseInt(req.nextUrl.searchParams.get("days") || "30");

  const [
    today, week, month,
    naturalYear, seasonalYear,
    trend, promotion,
    naturalCumulative, seasonalCumulative,
    progress,
  ] = await Promise.all([
    AnalyticsService.getTodaySummary(storeId),
    AnalyticsService.getWeekSummary(storeId),
    AnalyticsService.getMonthSummary(storeId),
    AnalyticsService.getNaturalYearSummary(storeId),
    AnalyticsService.getSeasonalYearSummary(storeId),
    AnalyticsService.getTrend(trendDays, storeId),
    AnalyticsService.getPromotionBreakdown(30, storeId),
    AnalyticsService.getCumulativeStats(storeId, "natural"),
    AnalyticsService.getCumulativeStats(storeId, "seasonal"),
    AnalyticsService.getProfitTargetProgress(storeId),
  ]);

  // 环比
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySum = await AnalyticsService.getCustomSummary(yesterday, yesterday, storeId);

  const salesChange = yesterdaySum.salesAmount > 0
    ? (today.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount : 0;
  const netSalesChange = yesterdaySum.netSales !== 0
    ? (today.netSales - yesterdaySum.netSales) / Math.abs(yesterdaySum.netSales) : 0;
  const refundChange = yesterdaySum.refundAmount > 0
    ? (today.refundAmount - yesterdaySum.refundAmount) / yesterdaySum.refundAmount : 0;

  return NextResponse.json({
    today, week, month,
    naturalYear, seasonalYear,
    trend, promotion,
    naturalCumulative, seasonalCumulative,
    progress,
    changes: { sales: salesChange, netSales: netSalesChange, refund: refundChange },
  });
}
