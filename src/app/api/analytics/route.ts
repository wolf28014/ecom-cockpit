import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService, StoreFilter } from "@/lib/analytics";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  const singleStoreId = req.nextUrl.searchParams.get("storeId");

  let storeFilter: StoreFilter;
  if (storeIdsParam) {
    const ids = storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id));
    storeFilter = ids.length === 0 ? userStoreIds : (ids.length === 1 ? ids[0] : ids);
  } else if (singleStoreId) {
    storeFilter = userStoreIds.includes(singleStoreId) ? singleStoreId : userStoreIds;
  } else {
    storeFilter = userStoreIds;
  }

  // 解析各 Tab 的日期参数
  const dayDate = req.nextUrl.searchParams.get("day");
  const weekDate = req.nextUrl.searchParams.get("week");
  const monthDate = req.nextUrl.searchParams.get("month");
  const yearType = (req.nextUrl.searchParams.get("yearType") || "natural") as "natural" | "seasonal";
  const selectedYear = parseInt(req.nextUrl.searchParams.get("year") || "0");

  const queryYear = selectedYear > 0 ? selectedYear : new Date().getFullYear();

  // 查询用户店铺 ID 列表用于直接查数据库
  const storeIdArray = Array.isArray(storeFilter) ? storeFilter : (storeFilter ? [storeFilter] : userStoreIds);

  // 辅助函数：查指定日期范围的数据
  async function getRangeData(start: Date, end: Date) {
    const where: any = {
      storeId: { in: storeIdArray },
      recordDate: { gte: start, lte: end },
    };
    const records = await db.dailyRecord.findMany({ where });
    if (records.length === 0) {
      return { salesAmount: 0, orderCount: 0, refundAmount: 0, visitors: 0, promotionTotal: 0, netSales: 0, refundRate: 0, promotionRate: 0, roi: 0, avgOrderValue: 0, conversionRate: 0 };
    }
    const sales = records.reduce((a, r) => a + r.salesAmount, 0);
    const orders = records.reduce((a, r) => a + r.orderCount, 0);
    const refund = records.reduce((a, r) => a + r.refundAmount, 0);
    const visitors = records.reduce((a, r) => a + r.visitors, 0);
    const promo = records.reduce((a, r) => a + (r.promotionManualTotal ?? r.promotionTotal), 0);
    const netSales = sales - refund;
    return {
      salesAmount: Math.round(sales * 100) / 100,
      orderCount: orders,
      refundAmount: Math.round(refund * 100) / 100,
      visitors,
      promotionTotal: Math.round(promo * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      refundRate: sales > 0 ? Math.round(refund / sales * 10000) / 10000 : 0,
      promotionRate: sales > 0 ? Math.round(promo / sales * 10000) / 10000 : 0,
      roi: promo > 0 ? Math.round(sales / promo * 100) / 100 : 0,
      avgOrderValue: orders > 0 ? Math.round(sales / orders * 100) / 100 : 0,
      conversionRate: visitors > 0 ? Math.round(orders / visitors * 10000) / 10000 : 0,
    };
  }

  // 辅助函数：查指定年份的累积指标
  async function getYearCumulative(yt: "natural" | "seasonal") {
    const today = new Date();
    let start: Date, end: Date;
    if (yt === "seasonal") {
      start = new Date(queryYear, 6, 1);
      end = new Date(queryYear + 1, 5, 30);
      if (queryYear === today.getFullYear()) end = today;
    } else {
      start = new Date(queryYear, 0, 1);
      end = new Date(queryYear, 11, 31);
      if (queryYear === today.getFullYear()) end = today;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const records = await db.dailyRecord.findMany({
      where: { storeId: { in: storeIdArray }, recordDate: { gte: start, lte: end } },
    });

    // 去年同期
    const lastStart = new Date(start); lastStart.setFullYear(lastStart.getFullYear() - 1);
    const lastEnd = new Date(end); lastEnd.setFullYear(lastEnd.getFullYear() - 1);
    const lastRecords = await db.dailyRecord.findMany({
      where: { storeId: { in: storeIdArray }, recordDate: { gte: lastStart, lte: lastEnd } },
    });

    const cumSales = records.reduce((a, r) => a + r.salesAmount, 0);
    const cumRefund = records.reduce((a, r) => a + r.refundAmount, 0);
    const cumPromo = records.reduce((a, r) => a + (r.promotionManualTotal ?? r.promotionTotal), 0);
    const cumNetSales = cumSales - cumRefund;
    const lastSales = lastRecords.reduce((a, r) => a + r.salesAmount, 0);

    return {
      cumulativeSales: Math.round(cumSales * 100) / 100,
      cumulativeRefund: Math.round(cumRefund * 100) / 100,
      cumulativeNetSales: Math.round(cumNetSales * 100) / 100,
      cumulativePromotion: Math.round(cumPromo * 100) / 100,
      cumulativeRefundRate: cumSales > 0 ? Math.round(cumRefund / cumSales * 10000) / 10000 : 0,
      cumulativePromotionRate: cumSales > 0 ? Math.round(cumPromo / cumSales * 10000) / 10000 : 0,
      cumulativeNetPromotionRate: cumNetSales > 0 ? Math.round(cumPromo / cumNetSales * 10000) / 10000 : 0,
      yoyGrowth: lastSales > 0 ? Math.round((cumSales - lastSales) / lastSales * 10000) / 10000 : 0,
    };
  }

  // 并行获取所有数据
  const [today, trend30] = await Promise.all([
    AnalyticsService.getTodaySummary(storeFilter),
    AnalyticsService.getTrend(30, storeFilter),
  ]);

  // 日分析数据（按选择的日期）
  let dayData = today;
  if (dayDate) {
    const d = new Date(dayDate); d.setHours(0, 0, 0, 0);
    dayData = await getRangeData(d, d);
  }

  // 周分析数据（按选择的日期所在周）
  let weekData: any = null;
  if (weekDate) {
    const d = new Date(weekDate); d.setHours(0, 0, 0, 0);
    const weekStart = new Date(d); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // 周一
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
    weekData = await getRangeData(weekStart, weekEnd);
  } else {
    weekData = await AnalyticsService.getWeekSummary(storeFilter);
  }

  // 月分析数据（按选择的日期所在月）
  let monthData: any = null;
  if (monthDate) {
    const d = new Date(monthDate);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0); monthEnd.setHours(23, 59, 59, 999);
    monthData = await getRangeData(monthStart, monthEnd);
  } else {
    monthData = await AnalyticsService.getMonthSummary(storeFilter);
  }

  // 年度数据和累积指标
  const [naturalYear, seasonalYear, naturalCumulative, seasonalCumulative] = await Promise.all([
    AnalyticsService.getNaturalYearSummary(storeFilter),
    AnalyticsService.getSeasonalYearSummary(storeFilter),
    getYearCumulative("natural"),
    getYearCumulative("seasonal"),
  ]);

  return NextResponse.json({
    today, dayData,
    weekData,
    monthData,
    naturalYear, seasonalYear,
    naturalCumulative, seasonalCumulative,
    trend30,
  });
}
