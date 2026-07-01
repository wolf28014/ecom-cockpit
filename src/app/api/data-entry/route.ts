import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PROMOTION_FIELDS } from "@/lib/analytics";
import { getCurrentUser, getCurrentUserStoreIds } from "@/lib/auth";

// GET: 查询指定店铺某日数据；或最近 N 天列表
export async function GET(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const storeId = req.nextUrl.searchParams.get("storeId");
  const date = req.nextUrl.searchParams.get("date");
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });
  // 校验店铺归属
  if (!userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限访问该店铺" }, { status: 403 });
  }

  if (date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const record = await db.dailyRecord.findUnique({
      where: { storeId_recordDate: { storeId, recordDate: targetDate } },
    });
    if (record) {
      // 解析 promotionData
      let promoData: Record<string, number> = {};
      try { promoData = JSON.parse(record.promotionData || "{}"); } catch {}
      return NextResponse.json({
        ...record,
        promotionData: promoData,
        promotionEffectiveTotal: record.promotionManualTotal ?? record.promotionTotal,
      });
    }
    return NextResponse.json(null);
  }

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const records = await db.dailyRecord.findMany({
    where: { storeId, recordDate: { gte: start, lte: end } },
    orderBy: { recordDate: "desc" },
  });
  return NextResponse.json(records);
}

// POST: 保存（新增或更新）每日数据
export async function POST(req: NextRequest) {
  const userStoreIds = await getCurrentUserStoreIds();
  if (!userStoreIds) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const {
    storeId, recordDate,
    salesAmount, orderCount, refundAmount, visitors,
    promotionData, promotionManualTotal,
  } = body;

  if (!storeId || !recordDate) {
    return NextResponse.json({ error: "Missing storeId or recordDate" }, { status: 400 });
  }
  // 校验店铺归属
  if (!userStoreIds.includes(storeId)) {
    return NextResponse.json({ error: "无权限操作该店铺" }, { status: 403 });
  }

  const date = new Date(recordDate);
  date.setHours(0, 0, 0, 0);

  const promoData: Record<string, number> = promotionData || {};
  // 确保所有 7 个字段都存在
  for (const f of PROMOTION_FIELDS) {
    if (!(f in promoData)) promoData[f] = 0;
  }
  const promoAutoTotal = Object.values(promoData).reduce((a: number, b: any) => a + Number(b || 0), 0);
  // 如果手填了合计，用它；否则用自动汇总
  const promoEffectiveTotal = promotionManualTotal != null && promotionManualTotal > 0
    ? Number(promotionManualTotal) : promoAutoTotal;

  const sales = Number(salesAmount || 0);
  const orders = Number(orderCount || 0);
  const refund = Number(refundAmount || 0);
  const visitorCount = Number(visitors || 0);

  // 自动计算
  const netSales = Math.round((sales - refund) * 100) / 100;
  const refundRate = sales > 0 ? Math.round(refund / sales * 10000) / 10000 : 0;
  const promotionRate = sales > 0 ? Math.round(promoEffectiveTotal / sales * 10000) / 10000 : 0;
  const roi = promoEffectiveTotal > 0 ? Math.round(sales / promoEffectiveTotal * 100) / 100 : 0;
  const avgOrderValue = orders > 0 ? Math.round(sales / orders * 100) / 100 : 0;
  const conversionRate = visitorCount > 0 ? Math.round(orders / visitorCount * 10000) / 10000 : 0;

  const existing = await db.dailyRecord.findUnique({
    where: { storeId_recordDate: { storeId, recordDate: date } },
  });

  const data = {
    salesAmount: sales,
    orderCount: orders,
    refundAmount: refund,
    visitors: visitorCount,
    promotionData: JSON.stringify(promoData),
    promotionTotal: Math.round(promoAutoTotal * 100) / 100,
    promotionManualTotal: promotionManualTotal != null && promotionManualTotal > 0
      ? Number(promotionManualTotal) : null,
    netSales,
    refundRate,
    promotionRate,
    roi,
    avgOrderValue,
    conversionRate,
  };

  if (existing) {
    const updated = await db.dailyRecord.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json(updated);
  } else {
    const created = await db.dailyRecord.create({
      data: { storeId, recordDate: date, ...data },
    });
    return NextResponse.json(created);
  }
}

// 推广字段元信息
export async function OPTIONS() {
  return NextResponse.json({ promotionFields: PROMOTION_FIELDS });
}
