import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const PLATFORM_CHOICES: Record<string, string> = {
  taobao: "淘宝店",
  tmall: "天猫店",
  douyin: "抖店",
  pinduoduo: "拼多多",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const stores = await db.store.findMany({
    where: { userId: user.id },
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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const store = await db.store.create({
    data: {
      ...body,
      userId: user.id,
    },
  });
  return NextResponse.json(store);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...data } = body;

  // 确保店铺属于当前用户
  const store = await db.store.findFirst({ where: { id, userId: user.id } });
  if (!store) {
    return NextResponse.json({ error: "店铺不存在或无权限" }, { status: 403 });
  }

  const updated = await db.store.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // 确保店铺属于当前用户
  const store = await db.store.findFirst({ where: { id, userId: user.id } });
  if (!store) {
    return NextResponse.json({ error: "店铺不存在或无权限" }, { status: 403 });
  }

  await db.store.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
