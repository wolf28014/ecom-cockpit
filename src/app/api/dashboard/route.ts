import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";

// 首页驾驶舱 - 综合数据
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const trendDays = parseInt(req.nextUrl.searchParams.get("days") || "30");

  const [today, week, month, year, trend, promotion, cost, progress] = await Promise.all([
    AnalyticsService.getTodaySummary(storeId),
    AnalyticsService.getWeekSummary(storeId),
    AnalyticsService.getMonthSummary(storeId),
    AnalyticsService.getYearSummary(storeId),
    AnalyticsService.getTrend(trendDays, storeId),
    AnalyticsService.getPromotionBreakdown(30, storeId),
    AnalyticsService.getCostBreakdown(30, storeId),
    AnalyticsService.getProfitTargetProgress(storeId),
  ]);

  // 环比：今日 vs 昨日
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySum = await AnalyticsService.getCustomSummary(yesterday, yesterday, storeId);

  const salesChange = yesterdaySum.salesAmount > 0
    ? (today.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount : 0;
  const profitChange = yesterdaySum.netProfit !== 0
    ? (today.netProfit - yesterdaySum.netProfit) / Math.abs(yesterdaySum.netProfit) : 0;

  return NextResponse.json({
    today, week, month, year, trend, promotion, cost, progress,
    changes: { sales: salesChange, profit: profitChange },
  });
}
