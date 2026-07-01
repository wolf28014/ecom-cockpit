import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PLATFORM_PROMOTION_FIELDS: Record<string, string[]> = {
  taobao: ["直通车", "万相台", "引力魔方", "淘宝客", "其他"],
  tmall: ["直通车", "万相台", "引力魔方", "淘宝客", "品牌专区", "其他"],
  douyin: ["千川投放", "小店随心推", "达人推广", "直播投放", "其他"],
  pinduoduo: ["多多搜索", "多多场景", "多多进宝", "明星店铺", "其他"],
};

// GET: 查询指定店铺某日数据；或最近 N 天列表
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  const date = req.nextUrl.searchParams.get("date");
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  if (date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const record = await db.dailyRecord.findUnique({
      where: { storeId_recordDate: { storeId, recordDate: targetDate } },
    });
    return NextResponse.json(record);
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
  const body = await req.json();
  const { storeId, recordDate, salesAmount, orderCount, refundAmount, refundOrderCount,
          promotionData, costData } = body;

  if (!storeId || !recordDate) {
    return NextResponse.json({ error: "Missing storeId or recordDate" }, { status: 400 });
  }

  const date = new Date(recordDate);
  date.setHours(0, 0, 0, 0);

  const promoData = promotionData || {};
  const promoTotal = Object.values(promoData).reduce((a: number, b: any) => a + Number(b), 0);
  const cData = costData || {};
  const costTotal = Object.values(cData).reduce((a: number, b: any) => a + Number(b), 0);

  const goodsCost = Number(cData["商品成本"] || 0);
  const shipping = Number(cData["运费"] || 0);
  const package_ = Number(cData["包装"] || 0);
  const labor = Number(cData["人工"] || 0);
  const rent = Number(cData["房租"] || 0);
  const other = Number(cData["其他"] || 0);

  const sales = Number(salesAmount || 0);
  const orders = Number(orderCount || 0);
  const refund = Number(refundAmount || 0);
  const refundOrders = Number(refundOrderCount || 0);

  const grossProfit = sales - goodsCost - refund;
  const netProfit = grossProfit - promoTotal - shipping - package_ - labor - rent - other;

  const existing = await db.dailyRecord.findUnique({
    where: { storeId_recordDate: { storeId, recordDate: date } },
  });

  const data = {
    salesAmount: sales,
    orderCount: orders,
    refundAmount: refund,
    refundOrderCount: refundOrders,
    promotionData: JSON.stringify(promoData),
    promotionTotal: promoTotal,
    costData: JSON.stringify(cData),
    costTotal,
    grossProfit: Math.round(grossProfit * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitRate: sales > 0 ? Math.round(netProfit / sales * 10000) / 10000 : 0,
    roi: promoTotal > 0 ? Math.round(sales / promoTotal * 100) / 100 : 0,
    avgOrderValue: orders > 0 ? Math.round(sales / orders * 100) / 100 : 0,
    profitPerOrder: orders > 0 ? Math.round(netProfit / orders * 100) / 100 : 0,
    refundRate: orders > 0 ? Math.round(refundOrders / orders * 10000) / 10000 : 0,
    promotionRate: sales > 0 ? Math.round(promoTotal / sales * 10000) / 10000 : 0,
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

// 暴露推广字段配置
export async function OPTIONS() {
  return NextResponse.json({ platforms: PLATFORM_PROMOTION_FIELDS });
}
