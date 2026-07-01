import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AnalyticsService, MONTHLY_COST_FIELDS } from "@/lib/analytics";

// GET: 获取月度成本
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  const year = req.nextUrl.searchParams.get("year");
  const month = req.nextUrl.searchParams.get("month");

  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  if (year && month) {
    const cost = await AnalyticsService.getMonthlyCost(storeId, Number(year), Number(month));
    return NextResponse.json(cost);
  }

  // 列出所有
  const costs = await AnalyticsService.getMonthlyCosts(storeId, year ? Number(year) : undefined);
  return NextResponse.json(costs);
}

// POST: 保存月度成本
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.storeId || !body.year || !body.month) {
    return NextResponse.json({ error: "Missing storeId/year/month" }, { status: 400 });
  }

  const data: any = {
    storeId: body.storeId,
    year: Number(body.year),
    month: Number(body.month),
  };
  for (const f of MONTHLY_COST_FIELDS) {
    data[f.key] = Number(body[f.key] || 0);
  }
  if (body.note !== undefined) data.note = body.note;

  const saved = await AnalyticsService.saveMonthlyCost(data);
  return NextResponse.json(saved);
}

// 字段定义
export async function OPTIONS() {
  return NextResponse.json({ fields: MONTHLY_COST_FIELDS });
}
