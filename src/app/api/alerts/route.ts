import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALERT_THRESHOLDS = {
  salesDeclineDays: 3,
  profitDeclinePct: 0.15,
  promotionRoiMin: 1.5,
  refundRateMax: 0.08,
  promotionRateMax: 0.25,
  costIncreasePct: 0.20,
};

// GET: 获取预警列表
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  const where: any = {};
  if (storeId) where.OR = [{ storeId }, { storeId: null }];
  if (unreadOnly) where.isRead = false;

  const alerts = await db.alert.findMany({
    where,
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });
  return NextResponse.json(alerts);
}

// POST: 触发预警检测
export async function POST(req: NextRequest) {
  const { storeId } = await req.json();
  const stores = storeId
    ? [await db.store.findUnique({ where: { id: storeId } })]
    : await db.store.findMany({ where: { isActive: true } });

  const newAlerts: any[] = [];

  for (const store of stores.filter(Boolean)) {
    const s = store!;
    // 取最近 N+1 天数据
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - ALERT_THRESHOLDS.salesDeclineDays);

    const records = await db.dailyRecord.findMany({
      where: { storeId: s.id, recordDate: { gte: start, lte: end } },
      orderBy: { recordDate: "desc" },
    });

    if (records.length < 2) continue;
    const today = records[0];
    const yesterday = records[1];

    // 1. 销售连续下降
    if (records.length >= ALERT_THRESHOLDS.salesDeclineDays) {
      let declineDays = 0;
      for (let i = 0; i < records.length - 1; i++) {
        if (records[i].salesAmount < records[i + 1].salesAmount) declineDays++;
        else break;
      }
      if (declineDays >= ALERT_THRESHOLDS.salesDeclineDays) {
        newAlerts.push({
          storeId: s.id, alertType: "sales_decline", level: "warning",
          title: `【${s.name}】销售连续 ${declineDays} 天下降`,
          content: `销售额从 ¥${records[records.length - 1].salesAmount.toLocaleString()} 下降至 ¥${today.salesAmount.toLocaleString()}`,
        });
      }
    }

    // 2. 利润下降
    if (yesterday.netProfit > 0) {
      const decline = (yesterday.netProfit - today.netProfit) / yesterday.netProfit;
      if (decline > ALERT_THRESHOLDS.profitDeclinePct) {
        newAlerts.push({
          storeId: s.id, alertType: "profit_decline",
          level: decline > 0.3 ? "critical" : "warning",
          title: `【${s.name}】利润环比下降 ${(decline * 100).toFixed(1)}%`,
          content: `昨日净利润 ¥${yesterday.netProfit.toLocaleString()}，今日净利润 ¥${today.netProfit.toLocaleString()}`,
        });
      }
    }

    // 3. ROI 偏低
    if (today.roi > 0 && today.roi < ALERT_THRESHOLDS.promotionRoiMin) {
      newAlerts.push({
        storeId: s.id, alertType: "promotion_roi_low", level: "critical",
        title: `【${s.name}】今日推广 ROI 偏低 (${today.roi.toFixed(2)})`,
        content: `今日推广 ROI 仅 ${today.roi.toFixed(2)}，低于阈值 ${ALERT_THRESHOLDS.promotionRoiMin}`,
      });
    }

    // 4. 退款率过高
    if (today.refundRate > ALERT_THRESHOLDS.refundRateMax) {
      newAlerts.push({
        storeId: s.id, alertType: "refund_rate_high", level: "warning",
        title: `【${s.name}】今日退款率 ${(today.refundRate * 100).toFixed(1)}%`,
        content: `今日退款率超过阈值 ${(ALERT_THRESHOLDS.refundRateMax * 100).toFixed(0)}%`,
      });
    }

    // 5. 推广费率过高
    if (today.promotionRate > ALERT_THRESHOLDS.promotionRateMax) {
      newAlerts.push({
        storeId: s.id, alertType: "promotion_rate_high", level: "warning",
        title: `【${s.name}】今日推广费率 ${(today.promotionRate * 100).toFixed(1)}%`,
        content: `今日推广费率超过阈值 ${(ALERT_THRESHOLDS.promotionRateMax * 100).toFixed(0)}%`,
      });
    }
  }

  // 写入数据库（去重：今日已存在则跳过）
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  let saved = 0;
  for (const a of newAlerts) {
    const existing = await db.alert.findFirst({
      where: { alertType: a.alertType, storeId: a.storeId, triggeredAt: { gte: today0 } },
    });
    if (!existing) {
      await db.alert.create({ data: a });
      saved++;
    }
  }

  return NextResponse.json({ checked: stores.length, generated: newAlerts.length, saved });
}

// PUT: 标记已读
export async function PUT(req: NextRequest) {
  const { id, all, storeId } = await req.json();
  if (all) {
    await db.alert.updateMany({
      where: storeId ? { OR: [{ storeId }, { storeId: null }] } : {},
      data: { isRead: true },
    });
  } else if (id) {
    await db.alert.update({ where: { id }, data: { isRead: true } });
  }
  return NextResponse.json({ ok: true });
}
