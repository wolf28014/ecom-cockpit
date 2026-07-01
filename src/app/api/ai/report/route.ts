import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AnalyticsService } from "@/lib/analytics";
import { callGLM4, SYSTEM_PROMPT_REPORT, SYSTEM_PROMPT_BOSS } from "@/lib/ai";

// GET: 获取报告列表
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const reportType = req.nextUrl.searchParams.get("type") || undefined;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");

  const where: any = {};
  if (storeId) where.storeId = storeId;
  if (reportType) where.reportType = reportType;
  // 当查询全店铺时，返回 storeId 为 null 或匹配的记录
  if (!storeId) where.OR = [{ storeId: null }, { storeId: "" }];

  const reports = await db.aiReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(reports);
}

// POST: 生成报告
export async function POST(req: NextRequest) {
  const { storeId, reportType } = await req.json();
  const sid = storeId || undefined;

  let userPrompt = "";
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (reportType === "daily") {
    const [todaySum, trend7, promo] = await Promise.all([
      AnalyticsService.getTodaySummary(sid),
      AnalyticsService.getTrend(7, sid),
      AnalyticsService.getPromotionBreakdown(7, sid),
    ]);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdaySum = await AnalyticsService.getCustomSummary(yesterday, yesterday, sid);

    userPrompt = `请基于以下数据生成【今日经营日报】。

今日数据（${todayStr}）：
- 销售额：¥${todaySum.salesAmount.toLocaleString()}
- 净利润：¥${todaySum.netProfit.toLocaleString()}
- 订单数：${todaySum.orderCount}
- 客单价：¥${todaySum.avgOrderValue.toFixed(2)}
- 利润率：${(todaySum.profitRate * 100).toFixed(1)}%
- ROI：${todaySum.roi.toFixed(2)}
- 推广费率：${(todaySum.promotionRate * 100).toFixed(1)}%
- 退款率：${(todaySum.refundRate * 100).toFixed(1)}%

昨日对比：
- 销售额：¥${yesterdaySum.salesAmount.toLocaleString()}
- 净利润：¥${yesterdaySum.netProfit.toLocaleString()}

近 7 天趋势：
${trend7.slice(-7).map(p => `  - ${p.date}: 销售¥${Math.round(p.sales).toLocaleString()}、利润¥${Math.round(p.profit).toLocaleString()}`).join("\n")}

推广渠道分布（近 7 天）：
${Object.entries(promo).map(([k, v]) => `  - ${k}: ¥${v.toLocaleString()}`).join("\n")}

请按 Markdown 格式输出日报，包含：核心数据、环比变化、异常诊断、行动建议。`;
  } else if (reportType === "weekly") {
    const [weekSum, trend14, skuStats] = await Promise.all([
      AnalyticsService.getWeekSummary(sid),
      AnalyticsService.getTrend(14, sid),
      AnalyticsService.getSkuStats(7, sid),
    ]);

    userPrompt = `请基于以下数据生成【本周经营周报】。

本周数据：
- 销售额：¥${weekSum.salesAmount.toLocaleString()}
- 净利润：¥${weekSum.netProfit.toLocaleString()}
- 订单数：${weekSum.orderCount}
- 利润率：${(weekSum.profitRate * 100).toFixed(1)}%
- ROI：${weekSum.roi.toFixed(2)}

近 14 天趋势：
${trend14.map(p => `  - ${p.date}: 销售¥${Math.round(p.sales).toLocaleString()}`).join("\n")}

本周 TOP 5 SKU：
${skuStats.slice(0, 5).map(s => `  - ${s.skuName}（${s.skuCode}）：销售¥${Math.round(s.salesAmount).toLocaleString()}、利润¥${Math.round(s.grossProfit).toLocaleString()}`).join("\n")}

请按 Markdown 格式输出周报，包含：本周总结、爆款表现、推广效果、问题诊断、下阶段建议。`;
  } else if (reportType === "monthly") {
    const [monthSum, trend30, skuStats, promo, cost] = await Promise.all([
      AnalyticsService.getMonthSummary(sid),
      AnalyticsService.getTrend(30, sid),
      AnalyticsService.getSkuStats(30, sid),
      AnalyticsService.getPromotionBreakdown(30, sid),
      AnalyticsService.getCostBreakdown(30, sid),
    ]);

    userPrompt = `请基于以下数据生成【本月经营月报】。

本月数据：
- 销售额：¥${monthSum.salesAmount.toLocaleString()}
- 净利润：¥${monthSum.netProfit.toLocaleString()}
- 订单数：${monthSum.orderCount}
- 利润率：${(monthSum.profitRate * 100).toFixed(1)}%
- ROI：${monthSum.roi.toFixed(2)}

本月 TOP 5 SKU：
${skuStats.slice(0, 5).map(s => `  - ${s.skuName}：销售¥${Math.round(s.salesAmount).toLocaleString()}`).join("\n")}

推广渠道分布：
${Object.entries(promo).map(([k, v]) => `  - ${k}: ¥${v.toLocaleString()}`).join("\n")}

成本结构：
${Object.entries(cost).map(([k, v]) => `  - ${k}: ¥${v.toLocaleString()}`).join("\n")}

请按 Markdown 格式输出月报，包含：月度总结、爆款分析、推广效果、成本诊断、下月建议。`;
  } else if (reportType === "suggestion") {
    const [todaySum, weekSum, skuStats, promo, progress] = await Promise.all([
      AnalyticsService.getTodaySummary(sid),
      AnalyticsService.getWeekSummary(sid),
      AnalyticsService.getSkuStats(7, sid),
      AnalyticsService.getPromotionBreakdown(7, sid),
      AnalyticsService.getProfitTargetProgress(sid),
    ]);

    let progressStr = "暂无目标";
    if (Object.keys(progress).length > 0) {
      progressStr = Object.entries(progress).map(([k, v]: any) =>
        `  - ${k}: 目标¥${v.target.toLocaleString()}、已完成¥${Math.round(v.actual).toLocaleString()} (${(v.rate * 100).toFixed(1)}%)`
      ).join("\n");
    }

    userPrompt = `请基于以下数据生成【今日经营建议】，覆盖 5 个维度：销售建议、推广建议、定价建议、库存建议、风险提醒。

今日核心数据：
- 销售额：¥${todaySum.salesAmount.toLocaleString()}
- 净利润：¥${todaySum.netProfit.toLocaleString()}
- 利润率：${(todaySum.profitRate * 100).toFixed(1)}%
- ROI：${todaySum.roi.toFixed(2)}
- 推广费率：${(todaySum.promotionRate * 100).toFixed(1)}%

本周数据：
- 销售额：¥${weekSum.salesAmount.toLocaleString()}
- 净利润：¥${weekSum.netProfit.toLocaleString()}

利润目标进度：
${progressStr}

近 7 天 TOP SKU：
${skuStats.slice(0, 5).map(s => `  - ${s.skuName}（${s.skuCode}）：销售¥${Math.round(s.salesAmount).toLocaleString()}、利润¥${Math.round(s.grossProfit).toLocaleString()}、ROI ${s.roi.toFixed(2)}`).join("\n")}

推广渠道分布：
${Object.entries(promo).map(([k, v]) => `  - ${k}: ¥${v.toLocaleString()}`).join("\n")}

请用 Markdown 输出，每个维度 2-3 条具体建议，附数据依据。`;
  }

  const content = await callGLM4(SYSTEM_PROMPT_REPORT, userPrompt);

  // 提取摘要
  let summary = "";
  for (const line of content.split("\n")) {
    const s = line.trim();
    if (s && !s.startsWith("#") && !s.startsWith("-")) {
      summary = s.slice(0, 150);
      break;
    }
  }

  const report = await db.aiReport.create({
    data: {
      storeId: storeId || null,
      reportType,
      periodStart: today,
      periodEnd: today,
      title: `AI ${reportType === "daily" ? "经营日报" : reportType === "weekly" ? "经营周报" : reportType === "monthly" ? "经营月报" : "经营建议"} - ${todayStr}`,
      content,
      summary,
    },
  });

  return NextResponse.json(report);
}
