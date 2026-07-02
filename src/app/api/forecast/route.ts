import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { getCurrentUserStoreIds } from "@/lib/auth";

// 现金流预测
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  if (storeId && !userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

  const effectiveFilter = storeId || userStoreIds;
  const trend = await AnalyticsService.getTrend(30, effectiveFilter);
  if (trend.length === 0) {
    return NextResponse.json({
      forecastDays: days,
      avgDailySales: 0, avgDailyProfit: 0, avgDailyCost: 0,
      projectedSales: 0, projectedProfit: 0, projectedCost: 0,
      projectedBalance: 0, riskLevel: "safe", dailyForecast: [],
    });
  }

  const avgSales = trend.reduce((a, p) => a + p.sales, 0) / trend.length;
  // TrendPoint 没有 profit/cost 字段，用净销售额近似利润、推广费近似成本
  const avgProfit = trend.reduce((a, p) => a + p.netSales, 0) / trend.length;
  const avgCost = trend.reduce((a, p) => a + p.promotion, 0) / trend.length;

  // 当前余额 = 年度累计净销售额（PeriodSummary 没有 netProfit，用 netSales 近似）
  const yearSummary = await AnalyticsService.getNaturalYearSummary(effectiveFilter);
  const currentBalance = yearSummary.netSales;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dailyForecast: any[] = [];
  let balance = currentBalance;

  for (let i = 1; i <= days; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const weekendBoost = d.getDay() >= 5 ? 1.2 : 1.0;
    const daySales = avgSales * weekendBoost;
    const dayCost = avgCost;
    const dayProfit = avgProfit * weekendBoost;
    balance += dayProfit;
    dailyForecast.push({
      date: d.toISOString().slice(0, 10),
      sales: Math.round(daySales * 100) / 100,
      cost: Math.round(dayCost * 100) / 100,
      profit: Math.round(dayProfit * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  const minBalance = Math.min(...dailyForecast.map(d => d.balance));
  const riskLevel = minBalance < 0 ? "danger" : (minBalance < avgCost * 7 ? "warning" : "safe");

  return NextResponse.json({
    forecastDays: days,
    avgDailySales: Math.round(avgSales * 100) / 100,
    avgDailyProfit: Math.round(avgProfit * 100) / 100,
    avgDailyCost: Math.round(avgCost * 100) / 100,
    projectedSales: Math.round(avgSales * days * 100) / 100,
    projectedProfit: Math.round(avgProfit * days * 100) / 100,
    projectedCost: Math.round(avgCost * days * 100) / 100,
    projectedBalance: Math.round(balance * 100) / 100,
    riskLevel,
    dailyForecast,
  });
}
