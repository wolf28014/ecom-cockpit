import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { callGLM4, SYSTEM_PROMPT_REPORT } from "@/lib/ai";

// AI 现金流预测
export async function POST(req: NextRequest) {
  const { storeId, days } = await req.json();
  const sid = storeId || undefined;
  const d = Number(days) || 30;

  const trend = await AnalyticsService.getTrend(30, sid);
  const avgSales = trend.length > 0 ? trend.reduce((a, p) => a + p.sales, 0) / trend.length : 0;
  const avgProfit = trend.length > 0 ? trend.reduce((a, p) => a + p.profit, 0) / trend.length : 0;
  const avgCost = trend.length > 0 ? trend.reduce((a, p) => a + p.cost, 0) / trend.length : 0;

  const userPrompt = `请基于以下数据预测未来 ${d} 天的现金流。

近 30 天日均数据：
- 日均销售额：¥${avgSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- 日均净利润：¥${avgProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- 日均成本：¥${avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}

预测未来 ${d} 天，并给出建议。请用 Markdown 输出，包含：收入预测、利润预测、支出预测、现金余额预测、风险提醒、优化建议。`;

  const result = await callGLM4(SYSTEM_PROMPT_REPORT, userPrompt);
  return NextResponse.json({ result });
}
