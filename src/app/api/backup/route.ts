import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET: 获取备份记录列表
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const records = await db.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(records);
}

// POST: 创建备份记录（Vercel 环境下数据已在云端数据库，此处记录备份动作）
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { type = "manual" } = await req.json();

  // 统计当前数据量
  const userStoreIds = (await db.store.findMany({
    where: { userId: user.id },
    select: { id: true },
  })).map(s => s.id);

  const [stores, dailyRecords, skus, monthlyCosts, targets] = await Promise.all([
    db.store.count({ where: { userId: user.id } }),
    db.dailyRecord.count({ where: { storeId: { in: userStoreIds } } }),
    db.sku.count({ where: { storeId: { in: userStoreIds } } }),
    db.monthlyCost.count({ where: { storeId: { in: userStoreIds } } }),
    db.profitTarget.count({ where: { storeId: { in: userStoreIds } } }),
  ]);

  const record = await db.backupRecord.create({
    data: {
      backupType: type,
      filePath: `vercel-postgres://${new Date().toISOString()}`,
      fileSize: stores + dailyRecords + skus + monthlyCosts + targets, // 记录数据条数
      status: "success",
      note: `备份时间 ${new Date().toLocaleString("zh-CN")} | 店铺${stores} 每日${dailyRecords} SKU${skus} 成本${monthlyCosts} 目标${targets}`,
    },
  });

  return NextResponse.json(record);
}

// DELETE: 删除备份记录
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.backupRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
