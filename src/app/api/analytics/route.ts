import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCache, setCache } from "@/lib/server-cache";

export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  let storeIdArray: string[];
  if (storeIdsParam) {
    storeIdArray = storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id));
    if (storeIdArray.length === 0) storeIdArray = userStoreIds;
  } else {
    storeIdArray = userStoreIds;
  }

  // 参数
  const dayDate = req.nextUrl.searchParams.get("day") || new Date().toISOString().slice(0, 10);
  const monthYear = parseInt(req.nextUrl.searchParams.get("monthYear") || String(new Date().getFullYear()));
  const monthMonth = parseInt(req.nextUrl.searchParams.get("monthMonth") || String(new Date().getMonth() + 1));
  const naturalYear = parseInt(req.nextUrl.searchParams.get("naturalYear") || String(new Date().getFullYear()));
  const seasonalYear = parseInt(req.nextUrl.searchParams.get("seasonalYear") || String(new Date().getFullYear()));

  // 服务端内存缓存（30秒TTL）
  const cacheKey = `analytics:${storeIdArray.join(",")}:${dayDate}:${monthYear}-${monthMonth}:N${naturalYear}:S${seasonalYear}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  // 辅助：查指定日期范围的数据
  async function getRangeData(start: Date, end: Date) {
    const records = await db.dailyRecord.findMany({
      where: { storeId: { in: storeIdArray }, recordDate: { gte: start, lte: end } },
    });
    return summarize(records);
  }

  // 辅助：查指定范围的累积指标（含同比）
  async function getCumulative(start: Date, end: Date) {
    const records = await db.dailyRecord.findMany({
      where: { storeId: { in: storeIdArray }, recordDate: { gte: start, lte: end } },
    });
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

  // 辅助：汇总记录为概览数据
  function summarize(records: any[]) {
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

  const today = new Date();

  // 1. 日分析：指定日期当天 + 当年累积
  const dayStart = new Date(dayDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate); dayEnd.setHours(23, 59, 59, 999);
  const naturalYearStart = new Date(dayStart.getFullYear(), 0, 1);
  const naturalYearEnd = new Date(dayStart.getFullYear(), 11, 31); naturalYearEnd.setHours(23, 59, 59, 999);
  const [dayData, dayCumulative] = await Promise.all([
    getRangeData(dayStart, dayEnd),
    getCumulative(naturalYearStart, naturalYearEnd),
  ]);

  // 2. 月分析：指定年月 + 当年累积
  const monthStart = new Date(monthYear, monthMonth - 1, 1);
  const monthEnd = new Date(monthYear, monthMonth, 0); monthEnd.setHours(23, 59, 59, 999);
  const monthYearStart = new Date(monthYear, 0, 1);
  const monthYearEnd = new Date(monthYear, 11, 31); monthYearEnd.setHours(23, 59, 59, 999);
  const [monthData, monthCumulative] = await Promise.all([
    getRangeData(monthStart, monthEnd),
    getCumulative(monthYearStart, monthYearEnd),
  ]);

  // 3. 自然年：1/1 ~ 12/31
  const natStart = new Date(naturalYear, 0, 1);
  const natEnd = new Date(naturalYear, 11, 31); natEnd.setHours(23, 59, 59, 999);
  const [naturalYearData, naturalYearCumulative] = await Promise.all([
    getRangeData(natStart, naturalYear < today.getFullYear() ? natEnd : today),
    getCumulative(natStart, natEnd),
  ]);

  // 4. 季节年：7/1 ~ 次年 6/30
  const seaStart = new Date(seasonalYear, 6, 1);
  const seaEnd = new Date(seasonalYear + 1, 5, 30); seaEnd.setHours(23, 59, 59, 999);
  const seaActualEnd = (seasonalYear < today.getFullYear() || (seasonalYear === today.getFullYear() && today.getMonth() < 6)) ? seaEnd : today;
  const [seasonalYearData, seasonalYearCumulative] = await Promise.all([
    getRangeData(seaStart, seaActualEnd),
    getCumulative(seaStart, seaEnd),
  ]);

  const result = {
    dayData, dayCumulative,
    monthData, monthCumulative,
    naturalYearData, naturalYearCumulative,
    seasonalYearData, seasonalYearCumulative,
  };
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
