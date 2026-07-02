import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { getCurrentUserStoreIds } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  // 校验店铺归属
  if (storeId && !userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

  // 未指定 storeId 时，限制到用户所有店铺
  const effectiveFilter = storeId || userStoreIds;
  const stats = await AnalyticsService.getSkuStats(days, effectiveFilter);
  return NextResponse.json({
    stats,
    rankings: {
      sales: [...stats].sort((a, b) => b.salesAmount - a.salesAmount),
      profit: [...stats].sort((a, b) => b.grossProfit - a.grossProfit),
      slow: [...stats].sort((a, b) => a.quantity - b.quantity),
      refund: [...stats].sort((a, b) => b.refundRate - a.refundRate),
    },
    totals: {
      count: stats.length,
      totalSales: stats.reduce((a, s) => a + s.salesAmount, 0),
      totalProfit: stats.reduce((a, s) => a + s.grossProfit, 0),
      avgRoi: stats.length > 0 ? stats.reduce((a, s) => a + s.roi, 0) / stats.length : 0,
      avgRefund: stats.length > 0 ? stats.reduce((a, s) => a + s.refundRate, 0) / stats.length : 0,
    },
  });
}
