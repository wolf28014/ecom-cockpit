import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getCurrentUserStoreIds } from "@/lib/auth";

// GET: 获取用户所有 SKU 列表
export async function GET() {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const skus = await db.sku.findMany({
    where: { storeId: { in: userStoreIds } },
    include: { store: { select: { name: true, platform: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(skus);
}

// POST: 新增 SKU
export async function POST(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { storeId, skuCode, skuName, category, unitCost, unitPrice, stock } = body;

  if (!storeId || !skuCode || !skuName) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }
  if (!userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const sku = await db.sku.create({
      data: {
        storeId,
        skuCode,
        skuName,
        category: category || null,
        unitCost: Number(unitCost) || 0,
        unitPrice: Number(unitPrice) || 0,
        stock: Number(stock) || 0,
      },
    });
    return NextResponse.json(sku);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "SKU 编码已存在" }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: 更新 SKU
export async function PUT(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...data } = body;

  const sku = await db.sku.findUnique({ where: { id } });
  if (!sku || !userStoreIds.includes(sku.storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const updated = await db.sku.update({
    where: { id },
    data: {
      ...(data.skuCode ? { skuCode: data.skuCode } : {}),
      ...(data.skuName ? { skuName: data.skuName } : {}),
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.unitCost !== undefined ? { unitCost: Number(data.unitCost) } : {}),
      ...(data.unitPrice !== undefined ? { unitPrice: Number(data.unitPrice) } : {}),
      ...(data.stock !== undefined ? { stock: Number(data.stock) } : {}),
    },
  });
  return NextResponse.json(updated);
}

// DELETE: 删除 SKU（含关联的 DailySku 数据）
export async function DELETE(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  const deleteAll = req.nextUrl.searchParams.get("all") === "true";
  const storeId = req.nextUrl.searchParams.get("storeId");

  if (deleteAll) {
    // 删除指定店铺（或所有店铺）的所有 SKU 及关联数据
    const where = storeId
      ? { storeId: userStoreIds.includes(storeId) ? storeId : "" }
      : { storeId: { in: userStoreIds } };

    // 先删 DailySku
    await db.dailySku.deleteMany({ where });
    // 再删 Sku
    await db.sku.deleteMany({ where });
    return NextResponse.json({ ok: true, message: "已清空所有 SKU 数据" });
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sku = await db.sku.findUnique({ where: { id } });
  if (!sku || !userStoreIds.includes(sku.storeId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  await db.dailySku.deleteMany({ where: { skuId: id } });
  await db.sku.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
