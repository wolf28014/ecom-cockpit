import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";

// 现金流预测
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

  const trend = await AnalyticsService.getTrend(30, storeId);
  if (trend.length === 0) {
    return NextResponse.json({
      forecastDays: days,
      avgDailySales: 0, avgDailyProfit: 0, avgDailyCost: 0,
      projectedSales: 0, projectedProfit: 0, projectedCost: 0,
      projectedBalance: 0, riskLevel: "safe", dailyForecast: [],
    });
  }

  const avgSales = trend.reduce((a, p) => a + p.sales, 0) / trend.length;
  const avgProfit = trend.reduce((a, p) => a + p.profit, 0) / trend.length;
  const avgCost = trend.reduce((a, p) => a + p.cost, 0) / trend.length;

  // 当前余额 = 年度累计净利润
  const yearSummary = await AnalyticsService.getYearSummary(storeId);
  const currentBalance = yearSummary.netProfit;

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
