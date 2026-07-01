import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

  const stats = await AnalyticsService.getSkuStats(days, storeId);
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
