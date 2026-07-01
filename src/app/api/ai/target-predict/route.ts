import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics";
import { callGLM4, SYSTEM_PROMPT_REPORT } from "@/lib/ai";

// AI 利润目标预测
export async function POST(req: NextRequest) {
  const { storeId } = await req.json();
  const sid = storeId || undefined;

  const [yearSummary, progress] = await Promise.all([
    AnalyticsService.getYearSummary(sid),
    AnalyticsService.getProfitTargetProgress(sid),
  ]);

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const daysPassed = Math.floor((today.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const daysTotal = ((today.getFullYear() % 4 === 0 && today.getFullYear() % 100 !== 0) || today.getFullYear() % 400 === 0) ? 366 : 365;
  const dailyAvgProfit = daysPassed > 0 ? yearSummary.netProfit / daysPassed : 0;
  const projectedYearProfit = dailyAvgProfit * daysTotal;

  let progressStr = "暂未设置利润目标";
  if (Object.keys(progress).length > 0) {
    progressStr = Object.entries(progress).map(([k, v]: any) =>
      `  - ${k}: 目标¥${v.target.toLocaleString()}、已完成¥${Math.round(v.actual).toLocaleString()} (${(v.rate * 100).toFixed(1)}%)`
    ).join("\n");
  }

  const userPrompt = `请基于当前进度预测年度利润目标完成情况。

当前数据：
- 已经过去：${daysPassed} 天
- 全年天数：${daysTotal} 天
- 已完成净利润：¥${yearSummary.netProfit.toLocaleString()}
- 日均净利润：¥${dailyAvgProfit.toFixed(2)}
- 按当前节奏预计全年利润：¥${projectedYearProfit.toFixed(2)}

利润目标进度：
${progressStr}

请用 Markdown 输出：完成概率评估、缺口分析、达成路径建议、关键举措优先级。`;

  const result = await callGLM4(SYSTEM_PROMPT_REPORT, userPrompt);
  return NextResponse.json({ result });
}
