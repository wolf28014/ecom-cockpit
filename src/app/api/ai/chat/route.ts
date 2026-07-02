import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AnalyticsService } from "@/lib/analytics";
import { callGLM4, SYSTEM_PROMPT_BOSS } from "@/lib/ai";
import { getCurrentUserStoreIds } from "@/lib/auth";

// GET: 获取聊天历史
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get("storeId") || "";
  // 校验店铺归属
  if (storeId && !userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  // 查询该店铺或全店铺的历史
  const where = storeId
    ? { storeId }
    : { storeId: { in: [...userStoreIds, ""] } };
  const history = await db.chatHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(history.reverse());
}

// POST: 发送消息
export async function POST(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { storeId, question } = await req.json();
  // 校验店铺归属
  if (storeId && !userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  // 构造 store filter：指定店铺则用单店铺，否则用全部用户店铺
  const sid = storeId || userStoreIds;

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
