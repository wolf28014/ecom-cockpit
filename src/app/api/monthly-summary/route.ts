import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCache, setCache } from "@/lib/server-cache";

// 每月销售汇总：返回指定月份每天的明细 + 汇总
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  let storeIdArray = storeIdsParam
    ? storeIdsParam.split(",").filter(Boolean).filter(id => userStoreIds.includes(id))
    : userStoreIds;
  if (storeIdArray.length === 0) storeIdArray = userStoreIds;

  const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(req.nextUrl.searchParams.get("month") || String(new Date().getMonth() + 1));

  const cacheKey = `monthly-summary:${storeIdArray.join(",")}:${year}-${month}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); end.setHours(23, 59, 59, 999);

  const records = await db.dailyRecord.findMany({
    where: { storeId: { in: storeIdArray }, recordDate: { gte: start, lte: end } },
    orderBy: { recordDate: "asc" },
  });

  // 按日期聚合（多店铺同一天合并）
  const dayMap = new Map<string, any>();
  for (const r of records) {
    const key = r.recordDate.toISOString().slice(0, 10);
    if (!dayMap.has(key)) {
      dayMap.set(key, { date: key, sales: 0, orders: 0, refund: 0, promotion: 0, visitors: 0 });
    }
    const d = dayMap.get(key);
    d.sales += r.salesAmount;
    d.orders += r.orderCount;
    d.refund += r.refundAmount;
    d.promotion += (r.promotionManualTotal ?? r.promotionTotal);
    d.visitors += r.visitors;
  }

  const days = Array.from(dayMap.values()).map(d => {
    const netSales = d.sales - d.refund;
    return {
      date: d.date,
      sales: Math.round(d.sales * 100) / 100,
      orders: d.orders,
      refund: Math.round(d.refund * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      promotion: Math.round(d.promotion * 100) / 100,
      visitors: d.visitors,
      refundRate: d.sales > 0 ? Math.round(d.refund / d.sales * 10000) / 10000 : 0,
      promotionRate: d.sales > 0 ? Math.round(d.promotion / d.sales * 10000) / 10000 : 0,
      roi: d.promotion > 0 ? Math.round(d.sales / d.promotion * 100) / 100 : 0,
      avgOrderValue: d.orders > 0 ? Math.round(d.sales / d.orders * 100) / 100 : 0,
    };
  });

  const totalSales = days.reduce((a, d) => a + d.sales, 0);
  const totalOrders = days.reduce((a, d) => a + d.orders, 0);
  const totalRefund = days.reduce((a, d) => a + d.refund, 0);
  const totalPromo = days.reduce((a, d) => a + d.promotion, 0);
  const totalVisitors = days.reduce((a, d) => a + d.visitors, 0);
  const totalNetSales = totalSales - totalRefund;

  const total = {
    sales: Math.round(totalSales * 100) / 100,
    orders: totalOrders,
    refund: Math.round(totalRefund * 100) / 100,
    netSales: Math.round(totalNetSales * 100) / 100,
    promotion: Math.round(totalPromo * 100) / 100,
    visitors: totalVisitors,
    refundRate: totalSales > 0 ? Math.round(totalRefund / totalSales * 10000) / 10000 : 0,
    promotionRate: totalSales > 0 ? Math.round(totalPromo / totalSales * 10000) / 10000 : 0,
    roi: totalPromo > 0 ? Math.round(totalSales / totalPromo * 100) / 100 : 0,
    avgOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders * 100) / 100 : 0,
  };

  const result = {
    monthLabel: `${year}年${month}月`,
    days,
    total,
  };
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
