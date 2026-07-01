import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService, StoreFilter, getNaturalYearRange, getSeasonalYearRange } from "@/lib/analytics";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  const singleStoreId = req.nextUrl.searchParams.get("storeId");

  // 解析店铺筛选
  let storeFilter: StoreFilter;
  if (storeIdsParam) {
    const ids = storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id));
    storeFilter = ids.length === 0 ? userStoreIds : (ids.length === 1 ? ids[0] : ids);
  } else if (singleStoreId) {
    storeFilter = userStoreIds.includes(singleStoreId) ? singleStoreId : userStoreIds;
  } else {
    storeFilter = userStoreIds;
  }

  // 解析自定义日期范围
  const startDate = req.nextUrl.searchParams.get("start");
  const endDate = req.nextUrl.searchParams.get("end");

  // 各周期数据
  const [today, week, month, trend30] = await Promise.all([
    AnalyticsService.getTodaySummary(storeFilter),
    AnalyticsService.getWeekSummary(storeFilter),
    AnalyticsService.getMonthSummary(storeFilter),
    AnalyticsService.getTrend(30, storeFilter),
  ]);

  // 自定义日期范围数据
  let customSummary = null;
  let customCumulative = null;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    customSummary = await AnalyticsService.getCustomSummary(start, end, storeFilter);

    // 计算自定义范围的累积指标
    const records = await db.dailyRecord.findMany({
      where: {
        ...(typeof storeFilter === "string" ? { storeId: storeFilter } : {}),
        ...(Array.isArray(storeFilter) ? { storeId: { in: storeFilter } } : {}),
        recordDate: { gte: start, lte: end },
      },
    });

    const cumSales = records.reduce((a, r) => a + r.salesAmount, 0);
    const cumRefund = records.reduce((a, r) => a + r.refundAmount, 0);
    const cumPromotion = records.reduce((a, r) => a + (r.promotionManualTotal ?? r.promotionTotal), 0);
    const cumNetSales = cumSales - cumRefund;

    customCumulative = {
      cumulativeSales: Math.round(cumSales * 100) / 100,
      cumulativeRefund: Math.round(cumRefund * 100) / 100,
      cumulativeNetSales: Math.round(cumNetSales * 100) / 100,
      cumulativePromotion: Math.round(cumPromotion * 100) / 100,
      cumulativeRefundRate: cumSales > 0 ? Math.round(cumRefund / cumSales * 10000) / 10000 : 0,
      cumulativePromotionRate: cumSales > 0 ? Math.round(cumPromotion / cumSales * 10000) / 10000 : 0,
      cumulativeNetPromotionRate: cumNetSales > 0 ? Math.round(cumPromotion / cumNetSales * 10000) / 10000 : 0,
    };

    // 同比去年
    const lastStart = new Date(start); lastStart.setFullYear(lastStart.getFullYear() - 1);
    const lastEnd = new Date(end); lastEnd.setFullYear(lastEnd.getFullYear() - 1);
    const lastYearRecords = await db.dailyRecord.findMany({
      where: {
        ...(typeof storeFilter === "string" ? { storeId: storeFilter } : {}),
        ...(Array.isArray(storeFilter) ? { storeId: { in: storeFilter } } : {}),
        recordDate: { gte: lastStart, lte: lastEnd },
      },
    });
    const lastYearSales = lastYearRecords.reduce((a, r) => a + r.salesAmount, 0);
    customCumulative.yoyGrowth = lastYearSales > 0 ? Math.round((cumSales - lastYearSales) / lastYearSales * 10000) / 10000 : 0;
  }

  // 年度数据
  const [naturalYear, seasonalYear, naturalCumulative, seasonalCumulative] = await Promise.all([
    AnalyticsService.getNaturalYearSummary(storeFilter),
    AnalyticsService.getSeasonalYearSummary(storeFilter),
    AnalyticsService.getCumulativeStats(storeFilter, "natural"),
    AnalyticsService.getCumulativeStats(storeFilter, "seasonal"),
  ]);

  // 环比
  const today2 = new Date(); today2.setHours(0, 0, 0, 0);
  const yesterday = new Date(today2); yesterday.setDate(yesterday.getDate() - 1);
  const lastWeekStart = new Date(today2); lastWeekStart.setDate(lastWeekStart.getDate() - today2.getDay() - 7);
  const lastWeekEnd = new Date(lastWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

  const [yesterdaySum, lastWeekSum] = await Promise.all([
    AnalyticsService.getCustomSummary(yesterday, yesterday, storeFilter),
    AnalyticsService.getCustomSummary(lastWeekStart, lastWeekEnd, storeFilter),
  ]);

  const dailyChange = {
    sales: yesterdaySum.salesAmount > 0 ? (today.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount : 0,
    netSales: yesterdaySum.netSales !== 0 ? (today.netSales - yesterdaySum.netSales) / Math.abs(yesterdaySum.netSales) : 0,
  };
  const weeklyChange = {
    sales: lastWeekSum.salesAmount > 0 ? (week.salesAmount - lastWeekSum.salesAmount) / lastWeekSum.salesAmount : 0,
    netSales: lastWeekSum.netSales !== 0 ? (week.netSales - lastWeekSum.netSales) / Math.abs(lastWeekSum.netSales) : 0,
  };

  return NextResponse.json({
    today, week, month,
    naturalYear, seasonalYear,
    naturalCumulative, seasonalCumulative,
    customSummary, customCumulative,
    dailyChange, weeklyChange,
    trend30,
    customRange: { start: startDate, end: endDate },
  });
}
