import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AnalyticsService } from "@/lib/analytics";
import { callGLM4, SYSTEM_PROMPT_BOSS } from "@/lib/ai";

// GET: 获取聊天历史
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || "";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  const history = await db.chatHistory.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(history.reverse());
}

// POST: 发送消息
export async function POST(req: NextRequest) {
  const { storeId, question } = await req.json();
  const sid = storeId || undefined;

  // 保存用户消息
  await db.chatHistory.create({
    data: { storeId: storeId || "", role: "user", content: question },
  });

  // 构造上下文
  const context = await AnalyticsService.buildDataContext(sid);
  const systemPrompt = SYSTEM_PROMPT_BOSS.replace("{context}", context);

  // 调用 AI
  const answer = await callGLM4(systemPrompt, question);

  // 保存助手回复
  await db.chatHistory.create({
    data: { storeId: storeId || "", role: "assistant", content: answer },
  });

  return NextResponse.json({ answer });
}
