import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { callGLM4, SYSTEM_PROMPT_REPORT } from "@/lib/ai";

// AI 经营模拟
export async function POST(req: NextRequest) {
  const { storeId, scenario } = await req.json();
  const sid = storeId || undefined;

  const [today, week] = await Promise.all([
    AnalyticsService.getTodaySummary(sid),
    AnalyticsService.getWeekSummary(sid),
  ]);

  const userPrompt = `请基于当前经营数据进行情景模拟分析。

情景假设：${scenario}

当前数据：
- 今日销售额：¥${today.salesAmount.toLocaleString()}
- 今日净利润：¥${today.netProfit.toLocaleString()}
- 今日推广费：¥${today.promotionTotal.toLocaleString()}
- 今日 ROI：${today.roi.toFixed(2)}
- 本周销售额：¥${week.salesAmount.toLocaleString()}
- 本周净利润：¥${week.netProfit.toLocaleString()}

请用 Markdown 输出模拟结果：预计销售变化、预计利润变化、关键假设、风险提示、是否建议执行。`;

  const result = await callGLM4(SYSTEM_PROMPT_REPORT, userPrompt);
  return NextResponse.json({ result });
}
