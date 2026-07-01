import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const period = req.nextUrl.searchParams.get("period") || "all"; // daily | weekly | monthly | yearly

  const [today, week, month, trend14, trend30, trend180, skuStats, naturalYear, seasonalYear] = await Promise.all([
    AnalyticsService.getTodaySummary(storeId),
    AnalyticsService.getWeekSummary(storeId),
    AnalyticsService.getMonthSummary(storeId),
    AnalyticsService.getTrend(14, storeId),
    AnalyticsService.getTrend(30, storeId),
    AnalyticsService.getTrend(180, storeId),
    AnalyticsService.getSkuStats(30, storeId),
    AnalyticsService.getNaturalYearSummary(storeId),
    AnalyticsService.getSeasonalYearSummary(storeId),
  ]);

  // 环比
  const today2 = new Date(); today2.setHours(0, 0, 0, 0);
  const yesterday = new Date(today2); yesterday.setDate(yesterday.getDate() - 1);
  const lastWeekStart = new Date(today2); lastWeekStart.setDate(lastWeekStart.getDate() - today2.getDay() - 7);
  const lastWeekEnd = new Date(lastWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

  const [yesterdaySum, lastWeekSum, naturalCumulative, seasonalCumulative] = await Promise.all([
    AnalyticsService.getCustomSummary(yesterday, yesterday, storeId),
    AnalyticsService.getCustomSummary(lastWeekStart, lastWeekEnd, storeId),
    AnalyticsService.getCumulativeStats(storeId, "natural"),
    AnalyticsService.getCumulativeStats(storeId, "seasonal"),
  ]);

  const dailyChange = {
    sales: yesterdaySum.salesAmount > 0 ? (today.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount : 0,
    netSales: yesterdaySum.netSales !== 0 ? (today.netSales - yesterdaySum.netSales) / Math.abs(yesterdaySum.netSales) : 0,
  };
  const weeklyChange = {
    sales: lastWeekSum.salesAmount > 0 ? (week.salesAmount - lastWeekSum.salesAmount) / lastWeekSum.salesAmount : 0,
    netSales: lastWeekSum.netSales !== 0 ? (week.netSales - lastWeekSum.netSales) / Math.abs(lastWeekSum.netSales) : 0,
  };

  // 年度月度聚合
  const monthlyAgg: Record<string, { sales: number; netSales: number; promotion: number }> = {};
  for (const p of trend180) {
    const monthKey = p.date.slice(0, 7);
    if (!monthlyAgg[monthKey]) monthlyAgg[monthKey] = { sales: 0, netSales: 0, promotion: 0 };
    monthlyAgg[monthKey].sales += p.sales;
    monthlyAgg[monthKey].netSales += p.netSales;
    monthlyAgg[monthKey].promotion += p.promotion;
  }

  return NextResponse.json({
    today, week, month,
    naturalYear, seasonalYear,
    naturalCumulative, seasonalCumulative,
    dailyChange, weeklyChange,
    trend14, trend30,
    monthlyAgg,
    skuTop5: skuStats.slice(0, 5),
  });
}
