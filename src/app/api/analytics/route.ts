import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService, StoreFilter } from "@/lib/analytics";
import { getCurrentUserStoreIds } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  const singleStoreId = req.nextUrl.searchParams.get("storeId");

  // 解析店铺筛选（必须在用户店铺范围内）
  let storeFilter: StoreFilter;
  if (storeIdsParam) {
    const ids = storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id));
    storeFilter = ids.length === 0 ? userStoreIds : (ids.length === 1 ? ids[0] : ids);
  } else if (singleStoreId) {
    storeFilter = userStoreIds.includes(singleStoreId) ? singleStoreId : userStoreIds;
  } else {
    storeFilter = userStoreIds;
  }

  const [today, week, month, trend14, trend30, trend180, skuStats, naturalYear, seasonalYear] = await Promise.all([
    AnalyticsService.getTodaySummary(storeFilter),
    AnalyticsService.getWeekSummary(storeFilter),
    AnalyticsService.getMonthSummary(storeFilter),
    AnalyticsService.getTrend(14, storeFilter),
    AnalyticsService.getTrend(30, storeFilter),
    AnalyticsService.getTrend(180, storeFilter),
    AnalyticsService.getSkuStats(30, storeFilter),
    AnalyticsService.getNaturalYearSummary(storeFilter),
    AnalyticsService.getSeasonalYearSummary(storeFilter),
  ]);

  // 环比
  const today2 = new Date(); today2.setHours(0, 0, 0, 0);
  const yesterday = new Date(today2); yesterday.setDate(yesterday.getDate() - 1);
  const lastWeekStart = new Date(today2); lastWeekStart.setDate(lastWeekStart.getDate() - today2.getDay() - 7);
  const lastWeekEnd = new Date(lastWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

  const [yesterdaySum, lastWeekSum, naturalCumulative, seasonalCumulative] = await Promise.all([
    AnalyticsService.getCustomSummary(yesterday, yesterday, storeFilter),
    AnalyticsService.getCustomSummary(lastWeekStart, lastWeekEnd, storeFilter),
    AnalyticsService.getCumulativeStats(storeFilter, "natural"),
    AnalyticsService.getCumulativeStats(storeFilter, "seasonal"),
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
