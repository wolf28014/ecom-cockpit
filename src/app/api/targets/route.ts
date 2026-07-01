import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const where: any = {};
  if (storeId) where.OR = [{ storeId }, { storeId: null }];

  const targets = await db.profitTarget.findMany({
    where,
    orderBy: [{ targetYear: "desc" }, { targetType: "asc" }],
  });
  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
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
  return NextResponse.json(target);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;
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
  return NextResponse.json(target);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.profitTarget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
