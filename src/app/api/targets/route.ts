import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserStoreIds } from "@/lib/auth";
import { invalidateCache } from "@/lib/server-cache";

export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const where: any = { storeId: { in: userStoreIds } };
  if (storeId) {
    if (!userStoreIds.includes(storeId)) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    where.OR = [{ storeId }, { storeId: null }];
  }

  const targets = await db.profitTarget.findMany({
    where,
    orderBy: [{ targetYear: "desc" }, { targetType: "asc" }],
  });
  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json();
  if (body.storeId && !userStoreIds.includes(body.storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const target = await db.profitTarget.create({
    data: {
      storeId: body.storeId,
      targetType: body.targetType,
      targetYear: Number(body.targetYear),
      targetQuarter: body.targetQuarter ? Number(body.targetQuarter) : null,
      targetMonth: body.targetMonth ? Number(body.targetMonth) : null,
      targetAmount: Number(body.targetAmount),
      note: body.note || null,
    },
  });
  invalidateCache("dash:");
  return NextResponse.json(target);
}

export async function PUT(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;

  // 校验目标归属
  const existing = await db.profitTarget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.storeId && !userStoreIds.includes(existing.storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const target = await db.profitTarget.update({
    where: { id },
    data: {
      ...(data.targetType ? { targetType: data.targetType } : {}),
      ...(data.targetYear ? { targetYear: Number(data.targetYear) } : {}),
      ...(data.targetQuarter !== undefined ? { targetQuarter: data.targetQuarter ? Number(data.targetQuarter) : null } : {}),
      ...(data.targetMonth !== undefined ? { targetMonth: data.targetMonth ? Number(data.targetMonth) : null } : {}),
      ...(data.targetAmount ? { targetAmount: Number(data.targetAmount) } : {}),
      ...(data.note !== undefined ? { note: data.note || null } : {}),
    },
  });
  invalidateCache("dash:");
  return NextResponse.json(target);
}

export async function DELETE(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await db.profitTarget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.storeId && !userStoreIds.includes(existing.storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  await db.profitTarget.delete({ where: { id } });
  invalidateCache("dash:");
  return NextResponse.json({ ok: true });
}
