import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PLATFORM_CHOICES: Record<string, string> = {
  taobao: "淘宝店",
  tmall: "天猫店",
  douyin: "抖店",
  pinduoduo: "拼多多",
};

export async function GET() {
  const stores = await db.store.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { dailyRecords: true, skus: true } } },
  });
  return NextResponse.json(stores.map(s => ({
    ...s,
    platformLabel: PLATFORM_CHOICES[s.platform] || s.platform,
    dailyRecordsCount: s._count.dailyRecords,
    skusCount: s._count.skus,
  })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const store = await db.store.create({
    data: {
      name: body.name,
      platform: body.platform,
      shopUrl: body.shopUrl || null,
      shopId: body.shopId || null,
      contact: body.contact || null,
      note: body.note || null,
      isActive: body.isActive ?? true,
    },
  });
  return NextResponse.json(store);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;
  const store = await db.store.update({ where: { id }, data });
  return NextResponse.json(store);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.store.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
