import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { getCurrentUserStoreIds } from "@/lib/auth";

// 首页驾驶舱 - 综合数据（含自然年/季节年）
// 支持多店铺汇总：?storeIds=id1,id2,id3
// 自动按当前用户过滤店铺
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeIdsParam = req.nextUrl.searchParams.get("storeIds");
  const trendDays = parseInt(req.nextUrl.searchParams.get("days") || "30");

  // 解析店铺筛选：
  // - 请求指定的 storeIds 必须在用户的店铺范围内
  // - 不传则查询该用户所有店铺
  let storeFilter: string[] | undefined;
  if (storeIdsParam) {
    const requested = storeIdsParam.split(",").filter(Boolean);
    // 安全过滤：只保留属于当前用户的店铺
    storeFilter = requested.filter(id => userStoreIds.includes(id));
    if (storeFilter.length === 0) storeFilter = undefined;
  } else {
    // 不传 storeIds = 查询该用户所有店铺
    storeFilter = userStoreIds;
  }

  // 多店铺汇总时取第一条 storeId 用于 ProfitTarget 查询（兼容旧逻辑）
  const targetStoreId = storeFilter && storeFilter.length === 1 ? storeFilter[0] : undefined;

  const [
    today, week, month,
    naturalYear, seasonalYear,
    trend, promotion,
    naturalCumulative, seasonalCumulative,
    progress,
  ] = await Promise.all([
    AnalyticsService.getTodaySummary(storeFilter),
    AnalyticsService.getWeekSummary(storeFilter),
    AnalyticsService.getMonthSummary(storeFilter),
    AnalyticsService.getNaturalYearSummary(storeFilter),
    AnalyticsService.getSeasonalYearSummary(storeFilter),
    AnalyticsService.getTrend(trendDays, storeFilter),
    AnalyticsService.getPromotionBreakdown(30, storeFilter),
    AnalyticsService.getCumulativeStats(storeFilter, "natural"),
    AnalyticsService.getCumulativeStats(storeFilter, "seasonal"),
    AnalyticsService.getProfitTargetProgress(targetStoreId),
  ]);

  // 环比
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySum = await AnalyticsService.getCustomSummary(yesterday, yesterday, storeFilter);

  const salesChange = yesterdaySum.salesAmount > 0
    ? (today.salesAmount - yesterdaySum.salesAmount) / yesterdaySum.salesAmount : 0;
  const netSalesChange = yesterdaySum.netSales !== 0
    ? (today.netSales - yesterdaySum.netSales) / Math.abs(yesterdaySum.netSales) : 0;
  const refundChange = yesterdaySum.refundAmount > 0
    ? (today.refundAmount - yesterdaySum.refundAmount) / yesterdaySum.refundAmount : 0;

  return NextResponse.json({
    today, week, month,
    naturalYear, seasonalYear,
    trend, promotion,
    naturalCumulative, seasonalCumulative,
    progress,
    changes: { sales: salesChange, netSales: netSalesChange, refund: refundChange },
  });
}
